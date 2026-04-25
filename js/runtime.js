(() => {
  const { Square } = window.UpUpUpLogic;
  const { buildMap } = window.UpUpUpMap;
  const {
    getViewportSize,
    clamp,
    createSeed,
    numberOr,
    formatTime,
    formatDuration,
    AUTOSAVE_INTERVAL_MS,
    SAVE_VERSION,
    readCreditBalance,
    writeCreditBalance,
    readInfiniteBestRecord,
    writeInfiniteBestRecord,
    storageReadSave,
    storageWriteSave,
    writeStartMode,
    readStageEditorStage,
    unlockStage,
  } = window.UpUpUpShared;

  function startGame({ canvas, shell, initialSave, audio, mode = 'infinite', stage = 1 }) {
    let { width: CANVAS_W, height: CANVAS_H } = getViewportSize();
    const IS_TOUCH_DEVICE =
      window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const PIXEL_RATIO = IS_TOUCH_DEVICE
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : window.devicePixelRatio || 1;
    const gameMode = mode === 'stage' ? 'stage' : 'infinite';
    const gameStage = Math.max(1, Math.floor(Number.isFinite(Number(stage)) ? Number(stage) : 1));
    const DEFAULT_MAP_W = 900;
    const DEFAULT_GROUND_Y = 2040;
    const DEFAULT_GRID = 60;
    const createStageSeed = (stageNumber) => {
      const base = 0x6d2b79f5 ^ Math.imul(stageNumber, 0x9e3779b9);
      return base >>> 0;
    };

    function normalizeStageObject(input = {}, index = 0) {
      const type =
        input.type === 'star' || input.type === 'portal'
          ? 'star'
          : input.type === 'windmill'
            ? 'windmill'
            : input.type === 'moving-stick' || input.type === 'movingStick'
              ? 'moving-stick'
              : 'stick';
      const defaults =
        type === 'star'
          ? { width: 28, height: 28 }
          : type === 'windmill'
            ? { width: 280, height: 280 }
            : { width: 240, height: 18 };

      const object = {
        id: String(input.id || `${type}-${index + 1}`),
        type,
        x: Math.max(0, Math.round(numberOr(input.x, 100 + index * 24))),
        y: Math.max(0, Math.round(numberOr(input.y, 1400 + index * 24))),
        width: Math.max(1, Math.round(numberOr(input.width, defaults.width))),
        height: Math.max(1, Math.round(numberOr(input.height, defaults.height))),
      };

      if (type === 'moving-stick' && Number.isFinite(Number(input.speed))) {
        const rawSpeed = Number(input.speed);
        const rawDirection = String(input.direction || '').toLowerCase();
        object.speed = Math.max(0.1, Math.abs(rawSpeed));
        if (rawDirection === 'left' || rawDirection === 'right') {
          object.direction = rawDirection;
        } else {
          object.direction = rawSpeed < 0 ? 'left' : 'right';
        }
      } else if (type === 'moving-stick') {
        object.speed = 1.2;
        object.direction = String(input.direction || '').toLowerCase() === 'left' ? 'left' : 'right';
      }
      if (type === 'windmill' && Number.isFinite(Number(input.rotationSpeed))) {
        object.rotationSpeed = Number(input.rotationSpeed);
      }

      return object;
    }

    function normalizeStageData(raw) {
      if (!raw || typeof raw !== 'object') return null;

      const stageNumber = Math.max(1, Math.floor(numberOr(raw.stage, gameStage)));
      const mapWidth = Math.max(200, Math.round(numberOr(raw?.settings?.mapWidth, DEFAULT_MAP_W)));
      const groundY = Math.max(0, Math.round(numberOr(raw?.settings?.groundY, DEFAULT_GROUND_Y)));
      const gridSize = Math.max(1, Math.round(numberOr(raw?.settings?.gridSize, DEFAULT_GRID)));

      return {
        version: 1,
        stage: stageNumber,
        name: String(raw.name || `?ㅽ뀒?댁? ${stageNumber}`),
        settings: {
          mapWidth,
          groundY,
          gridSize,
        },
        objects: Array.isArray(raw.objects)
          ? raw.objects.map((object, index) => normalizeStageObject(object, index))
          : [],
      };
    }

    const stageLayout = gameMode === 'stage' ? normalizeStageData(readStageEditorStage(gameStage)) : null;
    const MAP_W = stageLayout?.settings.mapWidth ?? DEFAULT_MAP_W;
    const GRID = stageLayout?.settings.gridSize ?? DEFAULT_GRID;
    const MAX_PULL = GRID * 4.5;
    const GROUND_Y = stageLayout?.settings.groundY ?? DEFAULT_GROUND_Y;
    const PLAYER_RADIUS = 8;
    const PLAYER_BORDER = 3;
    const STAGE_CLEAR_REWARD = 5;
    const PLAYER_SIZE = 44;
    const DEFAULT_PLAYER_X = Math.round(MAP_W / 2 - PLAYER_SIZE / 2);

    const prefs = shell.getPreferences();
    let autoSaveEnabled = prefs.autoSaveEnabled;
    let gridVisible = prefs.gridVisible;
    let isLoadingFromSave = false;
    const gameExitBtn = document.getElementById('game-exit-btn');
    if (gameExitBtn) {
      gameExitBtn.textContent = '× 종료';
      gameExitBtn.setAttribute('aria-label', '게임 종료');
    }
    let bestScoreHud = document.getElementById('best-score-hud');
    if (!bestScoreHud) {
      bestScoreHud = document.createElement('div');
      bestScoreHud.id = 'best-score-hud';
      bestScoreHud.className = 'best-score-hud';
      bestScoreHud.hidden = true;
      bestScoreHud.setAttribute('aria-live', 'polite');
      document.body.appendChild(bestScoreHud);
    }
    let playTimeHud = null;
    let creditHud = null;
    let runElapsedBaseMs = 0;
    let runElapsedSessionMs = 0;
    let runLastPerfMs = performance.now();
    let runPaused = false;
    let bestRecord = { score: 0, elapsedMs: null, savedAt: 0 };

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

    const gameSeed = initialSave?.seed ?? (gameMode === 'stage' ? createStageSeed(gameStage) : createSeed());
    const initialCollectedCreditIds = initialSave?.map?.collectedCreditIds ?? [];
    let stageStarsCollected = 0;
    let stageStarTotal = 0;
    const map = buildMap({
      PIXI,
      world,
      MAP_W,
      GROUND_Y,
      GRID,
      mode: gameMode,
      stage: gameStage,
      seed: gameSeed,
      stageLayout,
      collectedCreditIds: initialCollectedCreditIds,
      collectedStarIds: initialSave?.map?.collectedStarIds ?? [],
      collectedPortalIds: initialSave?.map?.collectedPortalIds ?? [],
    });

    stageStarTotal = gameMode === 'stage' ? (map.stars ?? map.portals ?? []).length : 0;
    stageStarsCollected = gameMode === 'stage'
      ? (map.stars ?? map.portals ?? []).filter((star) => star.collected).length
      : 0;

    if (initialSave?.map?.nextSpawnY != null) {
      map.generateTo(initialSave.map.nextSpawnY);
    }

    let activeMap = null;
    let cameraZoom = 1;
    let cameraLeft = 0;
    let cameraTop = 0;
    let score = 0;
    let creditBalance = readCreditBalance();
    let player = null;
    let scoreText = null;
    let multiplierText = null;
    let modeText = null;
    let stageStarText = null;
    let autosaveTimer = null;
    let stageCleared = false;
    let saveQueue = Promise.resolve();

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
        scoreText.y = 8;
      }
      if (multiplierText) {
        multiplierText.x = CANVAS_W / 2;
        multiplierText.y = scoreText ? scoreText.y + scoreText.height - 6 : 48;
      }
    }

    function updateBestScoreHud() {
      if (!bestScoreHud) return;
      if (gameMode !== 'infinite') {
        bestScoreHud.hidden = true;
        return;
      }
      bestScoreHud.hidden = false;
      bestScoreHud.classList.remove('is-menu-hud');
      bestScoreHud.classList.add('is-game-hud');
      bestScoreHud.textContent = `기록 ${bestRecord.score} · ${formatDuration(bestRecord.elapsedMs)}`;
    }

    function ensurePlayTimeHud() {
      if (gameMode !== 'infinite') return;
      if (!playTimeHud) {
        playTimeHud = document.getElementById('play-time-hud');
        if (!playTimeHud) {
          playTimeHud = document.createElement('div');
          playTimeHud.id = 'play-time-hud';
          playTimeHud.className = 'play-time-hud';
          playTimeHud.hidden = true;
          playTimeHud.setAttribute('aria-live', 'polite');
          document.body.appendChild(playTimeHud);
        }
      }
    }

    function ensureCreditHud() {
      if (!creditHud) {
        creditHud = document.getElementById('credit-hud');
        if (!creditHud) {
          creditHud = document.createElement('div');
          creditHud.id = 'credit-hud';
          creditHud.className = 'credit-hud';
          creditHud.hidden = true;
          creditHud.setAttribute('aria-live', 'polite');
          document.body.appendChild(creditHud);
        }
      }
    }

    function syncRunElapsed(now = performance.now()) {
      if (runPaused) {
        runLastPerfMs = now;
        return runElapsedBaseMs + runElapsedSessionMs;
      }

      const delta = Math.max(0, now - runLastPerfMs);
      runElapsedSessionMs += delta;
      runLastPerfMs = now;
      return runElapsedBaseMs + runElapsedSessionMs;
    }

    function getRunElapsedMs(now = performance.now()) {
      return syncRunElapsed(now);
    }

    function updatePlayTimeHud(now = performance.now()) {
      if (!playTimeHud || gameMode !== 'infinite') return;
      const elapsedMs = getRunElapsedMs(now);
      playTimeHud.hidden = false;
      playTimeHud.textContent = `시간 ${formatDuration(elapsedMs)}`;
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
        player.ctx.stars = activeMap.stars ?? activeMap.portals;
        player.ctx.portals = activeMap.portals ?? activeMap.stars;
      }
    }

    function updateMenuCreditBalance() {
      writeCreditBalance(creditBalance);
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
      if (modeText) {
        modeText.x = 14;
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
        if (gameMode === 'infinite' && (
          score > bestRecord.score ||
          (bestRecord.score > 0 && score === bestRecord.score && bestRecord.elapsedMs == null)
        )) {
          bestRecord = {
            score,
            elapsedMs: Math.max(0, Math.floor(getRunElapsedMs())),
            savedAt: Date.now(),
          };
          void writeInfiniteBestRecord(bestRecord);
          updateBestScoreHud();
        }
        layoutScoreHud();
      }
    }

    function updateCreditText() {
      ensureCreditHud();
      if (!creditHud) return;
      creditHud.hidden = false;
      creditHud.textContent = `크레딧 ${creditBalance}`;
    }

    function updateStageStarText() {
      if (!stageStarText) return;
      if (gameMode !== 'stage' || stageStarTotal <= 0) {
        stageStarText.visible = false;
        return;
      }

      stageStarText.visible = true;
      stageStarText.text = `별: ${Math.min(stageStarsCollected, stageStarTotal)}/${stageStarTotal}`;
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

    function rectIntersectsRect(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      );
    }

    function collectStageStar(star) {
      if (!star || star.collected) return false;
      star.collected = true;
      if (star.gfx) {
        star.gfx.visible = false;
        star.gfx.renderable = false;
      }

      stageStarsCollected = Math.min(stageStarTotal, stageStarsCollected + 1);
      updateStageStarText();
      audioManager?.playStarCollect?.();

      if (stageStarTotal > 0 && stageStarsCollected >= stageStarTotal) {
        completeStage();
      }

      return true;
    }

    function autosaveIfNeeded(reason) {
      if (autoSaveEnabled && !isLoadingFromSave) {
        void enqueueSave(reason);
      }
    }

    function pauseAutosaveTimer() {
      if (autosaveTimer) {
        window.clearInterval(autosaveTimer);
        autosaveTimer = null;
      }
    }

    function enqueueSave(reason = '수동 저장 완료') {
      const next = saveQueue.then(
        () => saveGame(reason),
        () => saveGame(reason)
      );
      saveQueue = next.catch(() => false);
      return next;
    }

    async function completeStage() {
      if (stageCleared) return;
      stageCleared = true;
      pauseAutosaveTimer();
      await unlockStage(gameStage);
      creditBalance += STAGE_CLEAR_REWARD;
      updateMenuCreditBalance();
      updateCreditText();
      await enqueueSave(`스테이지 ${gameStage} 클리어 보상`);
      setStatus(`스테이지 ${gameStage}를 클리어했습니다. 보상 +${STAGE_CLEAR_REWARD} 크레딧`);
      audioManager?.playStartSwoosh?.();
      shell.showStageClearPopup?.({
        stage: gameStage,
        reward: STAGE_CLEAR_REWARD,
        onConfirm: quitToMenu,
      });
    }

    async function quitToMenu() {
      shell.hideStageClearPopup?.();
      await enqueueSave('게임 종료 전 저장');
      writeStartMode('menu');
      window.location.reload();
    }

    function getSaveSnapshot() {
      if (!player || !map) return null;
      return {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        mode: gameMode,
        stage: gameStage,
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
        run: {
          elapsedMs: gameMode === 'infinite' ? Math.max(0, Math.floor(getRunElapsedMs())) : 0,
        },
      };
    }

    async function saveGame(reason = '수동 저장 완료') {
      try {
        const snapshot = getSaveSnapshot();
        if (!snapshot) {
          setStatus('저장할 게임 상태가 없습니다.');
          return false;
        }
        await storageWriteSave(snapshot);
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
    const initialSaveScore = numberOr(initialSaveForGame?.score, 0);
    const initialSaveElapsedMs = Number.isFinite(initialSaveForGame?.run?.elapsedMs)
      ? Math.max(0, Math.floor(initialSaveForGame.run.elapsedMs))
      : null;
    const storedBestRecord = gameMode === 'infinite'
      ? readInfiniteBestRecord()
      : { score: 0, elapsedMs: null, savedAt: 0 };
    const promoteInitialSave =
      gameMode === 'infinite' &&
      initialSaveScore > 0 &&
      (
        initialSaveScore > storedBestRecord.score ||
        (initialSaveScore === storedBestRecord.score &&
          storedBestRecord.elapsedMs == null &&
          initialSaveElapsedMs != null)
      );
    bestRecord = gameMode === 'infinite'
      ? (promoteInitialSave
        ? {
          score: initialSaveScore,
          elapsedMs: initialSaveElapsedMs,
          savedAt: initialSaveForGame?.savedAt ?? Date.now(),
        }
        : storedBestRecord)
      : { score: 0, elapsedMs: null, savedAt: 0 };
    if (promoteInitialSave) {
      void writeInfiniteBestRecord(bestRecord);
    }
    if (gameMode === 'infinite') {
      runElapsedBaseMs = initialSaveElapsedMs ?? 0;
      ensurePlayTimeHud();
      runLastPerfMs = performance.now();
    }
    updateBestScoreHud();
    updatePlayTimeHud();

    player = new Square(
      {
        PIXI,
        app,
        world,
        dotLayer: new PIXI.Graphics(),
        stickSurfaces: [],
        windmills: [],
        credits: [],
        stars: [],
        portals: [],
        onCreditCollected: null,
        onImpact: null,
        MAP_W,
        GROUND_Y,
        MAX_PULL,
        PLAYER_RADIUS,
        PLAYER_BORDER,
      },
      initialSaveForGame?.player?.x ?? DEFAULT_PLAYER_X,
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
      audioManager?.playCredit?.(creditValue);
      void enqueueSave('크레딧 획득 저장');
    };
    player.ctx.onImpact = (impact) => {
      audioManager?.playImpact(impact);
    };

    world.addChild(player.ctx.dotLayer);

    if (initialSaveForGame?.player) {
      player.gfx.x = numberOr(initialSaveForGame.player.x, DEFAULT_PLAYER_X);
      player.gfx.y = numberOr(initialSaveForGame.player.y, GROUND_Y - 44);
    } else {
      player.gfx.x = DEFAULT_PLAYER_X;
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
    if (gameMode === 'stage') {
      modeText = new PIXI.Text(`스테이지 ${gameStage}`, {
        fontFamily: 'Courier New',
        fontSize: 16,
        fill: 0x1a1a1a,
        fontWeight: '700',
      });
      modeText.anchor.set(0, 0);
      modeText.x = 14;
      modeText.y = 40;
      uiLayer.addChild(modeText);

      stageStarText = new PIXI.Text('별: 0/3', {
        fontFamily: 'Courier New',
        fontSize: 20,
        fill: 0x1a1a1a,
        fontWeight: '700',
      });
      stageStarText.anchor.set(0, 0);
      stageStarText.x = 14;
      stageStarText.y = 84;
      uiLayer.addChild(stageStarText);
      updateStageStarText();
      if (stageStarTotal > 0 && stageStarsCollected >= stageStarTotal) {
        completeStage();
      }
    }

    shell.setMenuVisible(false);
    shell.setGridVisible(gridVisible);
    shell.setAutosaveEnabled(autoSaveEnabled);
    ensureCreditHud();

    if (gameExitBtn) {
      gameExitBtn.hidden = false;
      gameExitBtn.addEventListener('click', quitToMenu);
    }

    syncCamera(true);
    refreshActiveMap();
    layoutScoreHud();
    updateScore(true);
    updateCreditText();
    updateStageStarText();
    updateMenuCreditBalance();
    audioManager?.suppressImpactsFor?.(900);
    audioManager?.playStartSwoosh();

    if (initialSaveForGame) {
      setStatus(`저장 데이터를 불러왔습니다 · ${formatTime(initialSaveForGame.savedAt ?? Date.now())}`);
    } else {
      setStatus(gameMode === 'stage'
        ? `스테이지 ${gameStage}를 시작합니다.`
        : '무한 모드를 시작합니다.');
    }

    shell.setActions({
      onSetGridVisible: (visible) => {
        setGridVisible(visible);
        setStatus(visible ? '그리드를 켰습니다.' : '그리드를 껐습니다.');
      },
      onToggleGrid: () => {
        const nextVisible = !gridVisible;
        setGridVisible(nextVisible);
        setStatus(nextVisible ? '그리드를 켰습니다.' : '그리드를 껐습니다.');
      },
      onQuit: () => {
        quitToMenu();
      },
    });

    app.stage.eventMode = 'static';
    app.ticker.maxFPS = 60;
    app.ticker.add(() => {
      if (stageCleared) return;
      const nowMs = performance.now();
      const now = nowMs * 0.001;
      if (gameMode === 'infinite') {
        syncRunElapsed(nowMs);
        updatePlayTimeHud(nowMs);
      }
      map.updateMovingSticks();
      for (const windmill of map.windmills) {
        if (windmill.chunk && !windmill.chunk.container.visible) continue;
        windmill.blades.rotation += windmill.speed;
      }
      for (const star of map.stars || map.portals || []) {
        if (!star || star.collected) continue;
        if (star.ringLayer) {
          const pulse = 1 + Math.sin(now * (star.pulseSpeed ?? 2) + (star.phase ?? 0)) * (star.pulseAmplitude ?? 0.05);
          star.ringLayer.scale.set(pulse);
        }
      }
      player.update();
      if (gameMode === 'stage') {
        for (const star of map.stars || map.portals || []) {
          if (!star || star.collected) continue;
          if (!rectIntersectsRect(player.gfx, star)) continue;
          if (collectStageStar(star)) break;
        }
      }
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
      if (gameMode === 'infinite') {
        syncRunElapsed();
        runPaused = true;
      }
      autosaveIfNeeded('Auto save');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (gameMode === 'infinite') {
          syncRunElapsed();
          runPaused = true;
        }
        autosaveIfNeeded('Auto save');
      } else if (gameMode === 'infinite') {
        runPaused = false;
        runLastPerfMs = performance.now();
      }
    });

    function restartAutosaveTimer() {
      pauseAutosaveTimer();
      autosaveTimer = window.setInterval(() => {
        autosaveIfNeeded('Auto save');
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
        pauseAutosaveTimer();
        app.destroy(true, { children: true, texture: false, baseTexture: false });
      },
    };
  }

  window.UpUpUpRuntime = { startGame };
})();







