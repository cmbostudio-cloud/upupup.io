(() => {
  const { Square } = window.UpUpUpLogic;
  const { buildMap } = window.UpUpUpMap;

  function getViewportSize() {
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    return {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  }

  let { width: CANVAS_W, height: CANVAS_H } = getViewportSize();
  const IS_TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
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

  const { grid, stickSurfaces, windmills, syncToCamera } = buildMap({
    PIXI,
    world,
    MAP_W,
    GROUND_Y,
    GRID,
  });

  const dotLayer = new PIXI.Graphics();
  world.addChild(dotLayer);

  let player = null;
  let scoreText = null;
  let gridVisible = true;
  let activeMap = null;
  let cameraZoom = 1;
  let cameraLeft = 0;
  let cameraTop = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

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
    const targetLeft = visibleWidth >= MAP_W
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
      activeMap = syncToCamera(cameraTop, cameraTop + getVisibleWorldHeight(), gridVisible);
      player.ctx.stickSurfaces = activeMap.stickSurfaces;
      player.ctx.windmills = activeMap.windmills;
    }
  }

  player = new Square({
    PIXI,
    app,
    world,
    dotLayer,
    stickSurfaces,
    windmills,
    MAP_W,
    GROUND_Y,
    MAX_PULL,
    PLAYER_RADIUS,
    PLAYER_BORDER,
  }, MAP_W / 2, GROUND_Y - 44);

  let score = 0;
  const scoreAnchorY = 14;

  scoreText = new PIXI.Text('0', {
    fontFamily: 'Courier New',
    fontSize: 24,
    fill: 0x1a1a1a,
    fontWeight: '700',
  });
  scoreText.anchor.set(0.5, 0);
  scoreText.x = CANVAS_W / 2;
  scoreText.y = scoreAnchorY;
  uiLayer.addChild(scoreText);

  function updateScore() {
    const currentHeight = Math.max(0, Math.floor((GROUND_Y - (player.gfx.y + player.size)) / GRID));
    if (currentHeight !== score) {
      score = currentHeight;
      scoreText.text = String(score);
    }
  }

  function followCamera() {
    syncCamera(false);
  }

  function setGridVisible(visible) {
    gridVisible = visible;
    grid.visible = gridVisible;
    settingsBtn.textContent = gridVisible ? 'GRID ON' : 'GRID OFF';
  }

  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => {
    setGridVisible(!gridVisible);
  });
  setGridVisible(true);

  syncCamera(true);
  activeMap = syncToCamera(cameraTop, cameraTop + getVisibleWorldHeight(), gridVisible);
  player.ctx.stickSurfaces = activeMap.stickSurfaces;
  player.ctx.windmills = activeMap.windmills;

  app.stage.eventMode = 'static';
  app.ticker.maxFPS = 60;
  app.ticker.add(() => {
    for (const windmill of windmills) {
      if (windmill.chunk && !windmill.chunk.container.visible) continue;
      windmill.blades.rotation += windmill.speed;
    }
    player.update();
    updateScore();
    followCamera();
    activeMap = syncToCamera(cameraTop, cameraTop + getVisibleWorldHeight(), gridVisible);
    player.ctx.stickSurfaces = activeMap.stickSurfaces;
    player.ctx.windmills = activeMap.windmills;
  });

  window.addEventListener('resize', resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
    window.visualViewport.addEventListener('scroll', resizeCanvas);
  }
  resizeCanvas();
})();
