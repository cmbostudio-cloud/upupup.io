(() => {
  const { Square } = window.UpUpUpLogic;
  const { buildMap } = window.UpUpUpMap;

  const SAVE_KEY = 'upupup.io.save.v1';
  const PREFS_KEY = 'upupup.io.prefs.v1';
  const SAVE_SECRET = 'upupup.io::save::v1::9f3c';
  const SAVE_VERSION = 1;
  const AUTOSAVE_INTERVAL_MS = 12000;

  function getViewportSize() {
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    return {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createSeed() {
    if (window.crypto?.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] || 0x12345678;
    }
    return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  }

  function fnv1a(text, seed = 0x811c9dc5) {
    let hash = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeSignature(payload) {
    const left = fnv1a(`${SAVE_SECRET}|${payload}`);
    const right = fnv1a(`${payload}|${SAVE_SECRET}`);
    return `${left.toString(36)}.${right.toString(36)}.${payload.length.toString(36)}`;
  }

  function encodeSave(data) {
    const payload = JSON.stringify(data);
    return JSON.stringify({
      version: SAVE_VERSION,
      payload,
      signature: makeSignature(payload),
    });
  }

  function decodeSave(raw) {
    let outer;
    try {
      outer = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!outer || outer.version !== SAVE_VERSION) return null;
    if (typeof outer.payload !== 'string' || typeof outer.signature !== 'string') return null;
    if (makeSignature(outer.payload) !== outer.signature) return null;

    try {
      const data = JSON.parse(outer.payload);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch {
      return null;
    }
  }

  function readJSONStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeJSONStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readPrefs() {
    const prefs = readJSONStorage(PREFS_KEY);
    return {
      autoSaveEnabled: prefs?.autoSaveEnabled !== false,
    };
  }

  function writePrefs(prefs) {
    try {
      writeJSONStorage(PREFS_KEY, {
        autoSaveEnabled: Boolean(prefs.autoSaveEnabled),
      });
    } catch {
      return false;
    }
    return true;
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function storageReadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return decodeSave(raw);
    } catch {
      return null;
    }
  }

  function storageWriteSave(data) {
    localStorage.setItem(SAVE_KEY, encodeSave(data));
  }

  const initialSave = storageReadSave();
  const prefs = readPrefs();
  let autoSaveEnabled = prefs.autoSaveEnabled;

  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const gridToggleBtn = document.getElementById('grid-toggle-btn');
  const saveBtn = document.getElementById('save-btn');
  const loadBtn = document.getElementById('load-btn');
  const autosaveBtn = document.getElementById('autosave-btn');
  const saveStatus = document.getElementById('save-status');

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

  const app = new PIXI.Application({
    view: document.getElementById('game-canvas'),
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

  const gameSeed = initialSave?.seed ?? createSeed();
  const map = buildMap({
    PIXI,
    world,
    MAP_W,
    GROUND_Y,
    GRID,
    seed: gameSeed,
  });

  if (initialSave?.map?.nextSpawnY != null) {
    map.generateTo(initialSave.map.nextSpawnY);
  }

  let player = null;
  let scoreText = null;
  let gridVisible = initialSave?.gridVisible !== false;
  let activeMap = null;
  let cameraZoom = 1;
  let cameraLeft = 0;
  let cameraTop = 0;
  let score = 0;
  let isLoadingFromSave = false;

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
    if (scoreText) {
      scoreText.x = CANVAS_W / 2;
    }
  }

  function resizeCanvas() {
    const viewport = getViewportSize();
    CANVAS_W = viewport.width;
    CANVAS_H = viewport.height;
    app.renderer.resize(CANVAS_W, CANVAS_H);
    syncCamera(true);
    if (scoreText) {
      scoreText.x = CANVAS_W / 2;
    }
    if (player) {
      activeMap = map.syncToCamera(cameraTop, cameraTop + getVisibleWorldHeight(), gridVisible);
      player.ctx.stickSurfaces = activeMap.stickSurfaces;
      player.ctx.windmills = activeMap.windmills;
    }
  }

  function computeScore() {
    if (!player) return 0;
    return Math.max(0, Math.floor((GROUND_Y - (player.gfx.y + player.size)) / GRID));
  }

  function updateScore(force = false) {
    const current = computeScore();
    if (force || current !== score) {
      score = current;
      scoreText.text = String(score);
    }
  }

  function followCamera() {
    syncCamera(false);
  }

  function setPanelOpen(open) {
    settingsPanel.classList.toggle('open', open);
    settingsBtn.setAttribute('aria-expanded', String(open));
    settingsPanel.setAttribute('aria-hidden', String(!open));
  }

  function setGridVisible(visible) {
    gridVisible = Boolean(visible);
    map.grid.visible = gridVisible;
    gridToggleBtn.textContent = gridVisible ? '격자: 켜짐' : '격자: 꺼짐';
  }

  function setAutosaveEnabled(enabled) {
    autoSaveEnabled = Boolean(enabled);
    autosaveBtn.textContent = autoSaveEnabled ? '자동 저장: 켜짐' : '자동 저장: 꺼짐';
    writePrefs({ autoSaveEnabled });
  }

  function setStatus(message) {
    saveStatus.textContent = message;
  }

  function getSaveSnapshot() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      seed: map.getState().seed,
      gridVisible,
      player: {
        x: player.gfx.x,
        y: player.gfx.y,
        vx: player.vx,
        vy: player.vy,
        onGround: player.onGround,
      },
      map: map.getState(),
      score,
    };
  }

  function saveGame(reason = '저장 완료') {
    try {
      const snapshot = getSaveSnapshot();
      storageWriteSave(snapshot);
      setStatus(`${reason} · ${formatTime(snapshot.savedAt)}`);
      return true;
    } catch (error) {
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
    setStatus('저장 데이터가 확인되었습니다. 새로고침 후 복원합니다.');
    isLoadingFromSave = true;
    window.location.reload();
    return true;
  }

  player = new Square(
    {
      PIXI,
      app,
      world,
      dotLayer: new PIXI.Graphics(),
      stickSurfaces: [],
      windmills: [],
      MAP_W,
      GROUND_Y,
      MAX_PULL,
      PLAYER_RADIUS,
      PLAYER_BORDER,
    },
    initialSave?.player?.x ?? MAP_W / 2,
    initialSave?.player?.y ?? GROUND_Y - 44
  );

  player.vx = numberOr(initialSave?.player?.vx, 0);
  player.vy = numberOr(initialSave?.player?.vy, 0);
  player.onGround = Boolean(initialSave?.player?.onGround);

  let dotLayer = player.ctx.dotLayer;
  world.addChild(dotLayer);

  if (initialSave?.player) {
    player.gfx.x = numberOr(initialSave.player.x, MAP_W / 2);
    player.gfx.y = numberOr(initialSave.player.y, GROUND_Y - 44);
  }

  scoreText = new PIXI.Text('0', {
    fontFamily: 'Courier New',
    fontSize: 24,
    fill: 0x1a1a1a,
    fontWeight: '700',
  });
  scoreText.anchor.set(0.5, 0);
  scoreText.x = CANVAS_W / 2;
  scoreText.y = 14;
  uiLayer.addChild(scoreText);

  setGridVisible(gridVisible);
  setAutosaveEnabled(autoSaveEnabled);

  syncCamera(true);
  activeMap = map.syncToCamera(cameraTop, cameraTop + getVisibleWorldHeight(), gridVisible);
  player.ctx.stickSurfaces = activeMap.stickSurfaces;
  player.ctx.windmills = activeMap.windmills;
  updateScore(true);

  if (initialSave) {
    setStatus(`저장 데이터를 불러왔습니다 · ${formatTime(initialSave.savedAt ?? Date.now())}`);
  } else {
    setStatus('저장 데이터가 없습니다.');
  }

  settingsBtn.addEventListener('click', () => {
    setPanelOpen(!settingsPanel.classList.contains('open'));
  });

  document.addEventListener('pointerdown', (event) => {
    if (!settingsPanel.classList.contains('open')) return;
    if (event.target.closest('#settings-wrap')) return;
    setPanelOpen(false);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setPanelOpen(false);
    }
  });

  gridToggleBtn.addEventListener('click', () => {
    setGridVisible(!gridVisible);
    setStatus(gridVisible ? '격자를 표시합니다.' : '격자를 숨깁니다.');
  });

  saveBtn.addEventListener('click', () => {
    saveGame('수동 저장');
  });

  loadBtn.addEventListener('click', () => {
    loadCurrentSave();
  });

  autosaveBtn.addEventListener('click', () => {
    setAutosaveEnabled(!autoSaveEnabled);
    setStatus(autoSaveEnabled ? '자동 저장을 켰습니다.' : '자동 저장을 껐습니다.');
  });

  app.stage.eventMode = 'static';
  app.ticker.maxFPS = 60;
  app.ticker.add(() => {
    for (const windmill of map.windmills) {
      if (windmill.chunk && !windmill.chunk.container.visible) continue;
      windmill.blades.rotation += windmill.speed;
    }
    player.update();
    updateScore();
    followCamera();
    activeMap = map.syncToCamera(cameraTop, cameraTop + getVisibleWorldHeight(), gridVisible);
    player.ctx.stickSurfaces = activeMap.stickSurfaces;
    player.ctx.windmills = activeMap.windmills;
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

  let autosaveTimer = null;
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
})();
