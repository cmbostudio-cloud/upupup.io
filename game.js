(() => {
  const { Square } = window.UpUpUpLogic;
  const { buildMap } = window.UpUpUpMap;

  let CANVAS_W = window.innerWidth;
  let CANVAS_H = window.innerHeight;
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

  function centerWorldX() {
    return Math.round(CANVAS_W * 0.5 - MAP_W * 0.5);
  }

  function resizeCanvas() {
    CANVAS_W = window.innerWidth;
    CANVAS_H = window.innerHeight;
    app.renderer.resize(CANVAS_W, CANVAS_H);
    world.x = centerWorldX();
    if (scoreText) {
      scoreText.x = CANVAS_W / 2;
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

  world.x = centerWorldX();
  world.y = CANVAS_H / 2 - (player.gfx.y + player.size / 2);

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
    const ty = CANVAS_H / 2 - (player.gfx.y + player.size / 2);
    world.x = centerWorldX();
    world.y += (ty - world.y) * 0.1;
    scoreText.x = CANVAS_W / 2;
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

  let activeMap = syncToCamera(-world.y, -world.y + CANVAS_H, gridVisible);
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
    activeMap = syncToCamera(-world.y, -world.y + CANVAS_H, gridVisible);
    player.ctx.stickSurfaces = activeMap.stickSurfaces;
    player.ctx.windmills = activeMap.windmills;
  });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
})();
