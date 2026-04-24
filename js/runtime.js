(() => {
  const { Square } = window.UpUpUpLogic;
  const { buildMap } = window.UpUpUpMap;
  const {
    getViewportSize,
    clamp,
    createSeed,
    numberOr,
    formatTime,
    AUTOSAVE_INTERVAL_MS,
    SAVE_VERSION,
    storageReadSave,
    storageWriteSave,
    writeStartMode,
  } = window.UpUpUpShared;

  function startGame({ canvas, shell, initialSave, audio }) {
    let { width: CANVAS_W, height: CANVAS_H } = getViewportSize();
    const IS_TOUCH_DEVICE =
      window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const PIXEL_RATIO = IS_TOUCH_DEVICE
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : window.devicePixelRatio || 1;
    const MAP_W = 900;
    const GRID = 60;
    const MAX_PULL = GRID * 4.5;
    const GROUND_Y = 2040;
    const PLAYER_RADIUS = 8;
    const PLAYER_BORDER = 3;

    const prefs = shell.getPreferences();
    let autoSaveEnabled = prefs.autoSaveEnabled;
    let gridVisible = prefs.gridVisible;
    let isLoadingFromSave = false;
    const gameExitBtn = document.getElementById('game-exit-btn');

    const app = new PIXI.Application({
      view: canvas,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: 0xf5f1e8,
      antialias: !IS_TOUCH_DEVICE,
      resolution: PIXEL_RATIO,
      autoDensity: true,
    });

    const world = new PIXI.Container();
    app.stage.addChild(world);
    const uiLayer = new PIXI.Container();
    app.stage.addChild(uiLayer);
    const audioManager =
      audio ?? (window.UpUpUpAudio?.createAudioManager?.(shell.getPreferences().audioVolume) ?? null);

    const gameSeed = initialSave?.seed ?? createSeed();
    const initialCollectedCreditIds = initialSave?.map?.collectedCreditIds ?? [];
    const map = buildMap({
      PIXI,
      world,
      MAP_W,
      GROUND_Y,
      GRID,
      seed: gameSeed,
      collectedCreditIds: initialCollectedCreditIds,
    });

    if (initialSave?.map?.nextSpawnY != null) {
      map.generateTo(initialSave.map.nextSpawnY);
    }

    let activeMap = null;
    let cameraZoom = 1;
    let cameraLeft = 0;
    let cameraTop = 0;
    let score = 0;
    let creditBalance = numberOr(initialSave?.credits, numberOr(storageReadSave()?.credits, 0));
    let player = null;
    let scoreText = null;
    let multiplierText = null;
    let creditText = null;
    let autosaveTimer = null;

    function getCameraZoom() {
      if (!IS_TOUCH_DEVICE) return 1;
      return Math.min(1, CANVAS_W / MAP_W);
    }

    function getVisibleWorldWidth() {
      return CANVAS_W / cameraZoom;
    }

    function getVisibleWorldHeight() {
      return CANVAS_H / cameraZoom;
    }

    function layoutScoreHud() {
      if (scoreText) {
        scoreText.x = CANVAS_W / 2;
        scoreText.y = 10;
      }
      if (multiplierText) {
        multiplierText.x = CANVAS_W / 2;
        multiplierText.y = scoreText ? scoreText.y + scoreText.height - 2 : 56;
      }
    }

    function syncCamera(immediate = false) {
      if (!player) return;

      cameraZoom = getCameraZoom();
      const visibleWidth = getVisibleWorldWidth();
      const visibleHeight = getVisibleWorldHeight();
      const playerCenterX = player.gfx.x + player.size / 2;
      const playerCenterY = player.gfx.y + player.size / 2;
      const targetLeft =
        visibleWidth >= MAP_W
          ? (MAP_W - visibleWidth) / 2
          : clamp(playerCenterX - visibleWidth / 2, 0, MAP_W - visibleWidth);
      const targetTop = playerCenterY - visibleHeight / 2;

      if (immediate) {
        cameraLeft = targetLeft;
        cameraTop = targetTop;
      } else {
        cameraLeft += (targetLeft - cameraLeft) * 0.12;
        cameraTop += (targetTop - cameraTop) * 0.1;
      }

      world.scale.set(cameraZoom);
      world.x = -cameraLeft * cameraZoom;
      world.y = -cameraTop * cameraZoom;
    }

    function refreshActiveMap() {
      activeMap = map.syncToCamera(cameraTop, cameraTop + getVisibleWorldHeight(), gridVisible);
      if (player) {
        player.ctx.stickSurfaces = activeMap.stickSurfaces;
        player.ctx.windmills = activeMap.windmills;
        player.ctx.credits = activeMap.credits;
      }
    }

    function updateMenuCreditBalance() {
      shell.setCreditBalance(creditBalance);
    }

    function resizeCanvas() {
      const viewport = getViewportSize();
      CANVAS_W = viewport.width;
      CANVAS_H = viewport.height;
      app.renderer.resize(CANVAS_W, CANVAS_H);
      syncCamera(true);
      layoutScoreHud();
      if (scoreText) {
        scoreText.x = CANVAS_W / 2;
      }
      if (multiplierText) {
        multiplierText.x = CANVAS_W / 2;
      }
      if (creditText) {
        creditText.x = 14;
      }
      if (player) {
        refreshActiveMap();
      }
    }

    function computeScore() {
      if (!player) return 0;
      return Math.max(0, Math.floor((GROUND_Y - (player.gfx.y + player.size)) / GRID));
    }

    function getCreditValue(scoreValue = score) {
      return 1 + Math.floor(Math.max(0, scoreValue - 1) / 50);
    }

    function updateScore(force = false) {
      const current = computeScore();
      if (force || current !== score) {
        score = current;
        scoreText.text = String(score);
        if (multiplierText) {
          multiplierText.text = `x${getCreditValue(score)}`;
        }
        layoutScoreHud();
      }
    }

    function updateCreditText() {
      if (!creditText) return;
      creditText.text = `CREDIT ${creditBalance}`;
    }

    function followCamera() {
      syncCamera(false);
    }

    function setGridVisible(visible) {
      gridVisible = Boolean(visible);
      if (map?.grid) {
        map.grid.visible = gridVisible;
      }
      shell.setGridVisible(gridVisible);
      refreshActiveMap();
    }

    function setAutosaveEnabled(enabled) {
      autoSaveEnabled = Boolean(enabled);
      shell.setAutosaveEnabled(autoSaveEnabled);
    }

    function setStatus(message) {
      shell.setStatus(message);
    }

    function quitToMenu() {
      writeStartMode('menu');
      window.location.reload();
    }

    function getSaveSnapshot() {
      if (!player || !map) return null;
      return {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        seed: map.getState().seed,
        player: {
          x: player.gfx.x,
          y: player.gfx.y,
          vx: player.vx,
          vy: player.vy,
          onGround: player.onGround,
        },
        map: map.getState(),
        score,
        credits: creditBalance,
      };
    }

    function saveGame(reason = '수동 저장 완료') {
      try {
        const snapshot = getSaveSnapshot();
        if (!snapshot) {
          setStatus('저장할 게임 상태가 없습니다.');
          return false;
        }
        storageWriteSave(snapshot);
        shell.updateMenuState(snapshot);
        updateMenuCreditBalance();
        setStatus(`${reason} · ${formatTime(snapshot.savedAt)}`);
        return true;
      } catch {
        setStatus('저장에 실패했습니다.');
        return false;
      }
    }

    function loadCurrentSave() {
      const saved = storageReadSave();
      if (!saved) {
        setStatus('불러올 저장 데이터가 없습니다.');
        return false;
      }
      setStatus('저장 데이터를 확인했습니다. 이어서 불러옵니다.');
      writeStartMode('continue');
      isLoadingFromSave = true;
      window.location.reload();
      return true;
    }

    const initialSaveForGame = initialSave ?? null;

    player = new Square(
      {
        PIXI,
        app,
        world,
        dotLayer: new PIXI.Graphics(),
        stickSurfaces: [],
        windmills: [],
        credits: [],
        onCreditCollected: null,
        onImpact: null,
        MAP_W,
        GROUND_Y,
        MAX_PULL,
        PLAYER_RADIUS,
        PLAYER_BORDER,
      },
      initialSaveForGame?.player?.x ?? MAP_W / 2,
      initialSaveForGame?.player?.y ?? GROUND_Y - 44
    );

    player.vx = numberOr(initialSaveForGame?.player?.vx, 0);
    player.vy = numberOr(initialSaveForGame?.player?.vy, 0);
    player.onGround = Boolean(initialSaveForGame?.player?.onGround);
    player.ctx.onCreditCollected = (credit) => {
      if (!map.collectCredit(credit)) return;
      const creditValue = getCreditValue(computeScore());
      creditBalance += creditValue;
      updateMenuCreditBalance();
      updateCreditText();
      audioManager?.playCollect(creditValue);
    };
    player.ctx.onImpact = (strength) => {
      audioManager?.playImpact(strength);
    };

    world.addChild(player.ctx.dotLayer);

    if (initialSaveForGame?.player) {
      player.gfx.x = numberOr(initialSaveForGame.player.x, MAP_W / 2);
      player.gfx.y = numberOr(initialSaveForGame.player.y, GROUND_Y - 44);
    }

    scoreText = new PIXI.Text('0', {
      fontFamily: 'Courier New',
      fontSize: 42,
      fill: 0x111111,
      fontWeight: '900',
    });
    scoreText.anchor.set(0.5, 0);
    uiLayer.addChild(scoreText);

    multiplierText = new PIXI.Text('x1', {
      fontFamily: 'Courier New',
      fontSize: 16,
      fill: 0x1a1a1a,
      fontWeight: '700',
    });
    multiplierText.anchor.set(0.5, 0);
    uiLayer.addChild(multiplierText);

    creditText = new PIXI.Text('CREDIT 0', {
      fontFamily: 'Courier New',
      fontSize: 20,
      fill: 0x1a1a1a,
      fontWeight: '700',
    });
    creditText.anchor.set(0, 0);
    creditText.x = 14;
    creditText.y = 14;
    uiLayer.addChild(creditText);

    shell.setMenuVisible(false);
    shell.setChromeVisible(false);
    shell.setPanelOpen(false);
    shell.setGridVisible(gridVisible);
    shell.setAutosaveEnabled(autoSaveEnabled);

    if (gameExitBtn) {
      gameExitBtn.hidden = false;
      gameExitBtn.addEventListener('click', quitToMenu);
    }

    syncCamera(true);
    refreshActiveMap();
    layoutScoreHud();
    updateScore(true);
    updateCreditText();
    updateMenuCreditBalance();
    audioManager?.playStartSwoosh();

    if (initialSaveForGame) {
      setStatus(`저장 데이터를 불러왔습니다 · ${formatTime(initialSaveForGame.savedAt ?? Date.now())}`);
    } else {
      setStatus('새 게임을 시작합니다.');
    }

    shell.setActions({
      onSetGridVisible: (visible) => {
        setGridVisible(visible);
        setStatus(visible ? '격자선을 켰습니다.' : '격자선을 껐습니다.');
      },
      onToggleGrid: () => {
        const nextVisible = !gridVisible;
        setGridVisible(nextVisible);
        setStatus(nextVisible ? '격자선을 켰습니다.' : '격자선을 껐습니다.');
      },
      onQuit: () => {
        quitToMenu();
      },
    });

    app.stage.eventMode = 'static';
    app.ticker.maxFPS = 60;
    app.ticker.add(() => {
      map.updateMovingSticks();
      for (const windmill of map.windmills) {
        if (windmill.chunk && !windmill.chunk.container.visible) continue;
        windmill.blades.rotation += windmill.speed;
      }
      player.update();
      updateScore();
      followCamera();
      refreshActiveMap();
    });

    window.addEventListener('resize', resizeCanvas);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeCanvas);
      window.visualViewport.addEventListener('scroll', resizeCanvas);
    }

    window.addEventListener('pagehide', () => {
      if (autoSaveEnabled && !isLoadingFromSave) {
        saveGame('자동 저장');
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && autoSaveEnabled && !isLoadingFromSave) {
        saveGame('자동 저장');
      }
    });

    function restartAutosaveTimer() {
      if (autosaveTimer) {
        window.clearInterval(autosaveTimer);
      }
      autosaveTimer = window.setInterval(() => {
        if (autoSaveEnabled) {
          saveGame('자동 저장');
        }
      }, AUTOSAVE_INTERVAL_MS);
    }

    restartAutosaveTimer();
    resizeCanvas();

    return {
      saveGame,
      loadCurrentSave,
      setGridVisible,
      setAutosaveEnabled,
      destroy() {
        if (autosaveTimer) {
          window.clearInterval(autosaveTimer);
        }
        app.destroy(true, { children: true, texture: false, baseTexture: false });
      },
    };
  }

  window.UpUpUpRuntime = { startGame };
})();
