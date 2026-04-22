(() => {
  function buildMap({ PIXI, world, MAP_W, GROUND_Y, GRID }) {
    const grid = new PIXI.Graphics();
    world.addChild(grid);

    const groundLine = new PIXI.Graphics();
    groundLine.lineStyle(4, 0x7b6d5e, 1);
    groundLine.moveTo(0, GROUND_Y);
    groundLine.lineTo(MAP_W, GROUND_Y);
    world.addChild(groundLine);

    const wallFrame = new PIXI.Graphics();
    wallFrame.lineStyle(6, 0x1a1a1a, 1);
    wallFrame.moveTo(0, -10000000);
    wallFrame.lineTo(0, 10000000);
    wallFrame.moveTo(MAP_W, -10000000);
    wallFrame.lineTo(MAP_W, 10000000);
    world.addChild(wallFrame);

    const worldMask = new PIXI.Graphics();
    worldMask.beginFill(0xffffff);
    worldMask.drawRect(0, -10000000, MAP_W, 20000000);
    worldMask.endFill();
    worldMask.renderable = false;
    world.addChild(worldMask);
    world.mask = worldMask;

    const stickSurfaces = [];
    const windmills = [];
    const chunks = new Map();

    const CHUNK_HEIGHT = GRID * 8;
    const GENERATION_PAD = GRID * 16;
    const RENDER_PAD = GRID * 10;
    const STICK_HEIGHT = 18;
    const STICK_LENGTH = Math.round(210 * 1.33);
    const WALL_STICK_LENGTH = STICK_LENGTH;
    const MIN_STICK_X_GAP = Math.round(STICK_LENGTH * 0.5);
    const RECENT_RANDOM_STICKS = 3;

    let nextSpawnY = GROUND_Y - 780;
    let pathX = Math.round(MAP_W * 0.5);
    const recentRandomStickXs = [];

    function randRange(min, max) {
      return min + Math.random() * (max - min);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getWindmillBladeLength(scale = 1) {
      return Math.round(92 * scale * 1.5);
    }

    function getWindmillWallClearance(scale = 1) {
      const bladeLength = getWindmillBladeLength(scale);
      return bladeLength + 24;
    }

    function rememberRandomStickX(x) {
      recentRandomStickXs.push(x);
      while (recentRandomStickXs.length > RECENT_RANDOM_STICKS) {
        recentRandomStickXs.shift();
      }
    }

    function isFarEnoughFromRecentRandomSticks(x) {
      return recentRandomStickXs.every((prevX) => Math.abs(x - prevX) >= MIN_STICK_X_GAP);
    }

    function pickSeparatedStickX(preferredX, width) {
      const minX = 48;
      const maxX = MAP_W - width - 48;
      const targetX = clamp(preferredX, minX, maxX);
      const spread = Math.max(MIN_STICK_X_GAP * 1.75, 170);

      for (let i = 0; i < 24; i++) {
        const candidate = clamp(targetX + randRange(-spread, spread), minX, maxX);
        if (isFarEnoughFromRecentRandomSticks(candidate)) {
          return Math.round(candidate);
        }
      }

      const anchors = [
        minX,
        minX + (maxX - minX) * 0.25,
        minX + (maxX - minX) * 0.5,
        minX + (maxX - minX) * 0.75,
        maxX,
      ];

      let bestX = Math.round(targetX);
      let bestScore = -Infinity;
      for (const anchor of anchors) {
        const score = recentRandomStickXs.reduce(
          (minDistance, prevX) => Math.min(minDistance, Math.abs(anchor - prevX)),
          Infinity
        );
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(anchor);
        }
      }
      return bestX;
    }

    function addRandomStick(preferredX, y, width, height) {
      const x = pickSeparatedStickX(preferredX, width);
      addStick(x, y, width, height);
      rememberRandomStickX(x);
      return x;
    }

    function getChunkIndex(y) {
      return Math.floor(y / CHUNK_HEIGHT);
    }

    function createChunk(index) {
      const container = new PIXI.Container();
      container.visible = false;
      world.addChild(container);
      const chunk = {
        index,
        top: index * CHUNK_HEIGHT,
        bottom: index * CHUNK_HEIGHT + CHUNK_HEIGHT,
        container,
        stickSurfaces: [],
        windmills: [],
      };
      chunks.set(index, chunk);
      return chunk;
    }

    function ensureChunk(index) {
      return chunks.get(index) || createChunk(index);
    }

    function addStick(x, y, width, height) {
      const chunk = ensureChunk(getChunkIndex(y));
      const stick = new PIXI.Graphics();
      const capRadius = Math.max(1, Math.round(height * 0.5));
      stick.beginFill(0x111111);
      stick.drawRoundedRect(x, y, width, height, capRadius);
      stick.endFill();
      stick.beginFill(0xffffff, 0.08);
      stick.drawRoundedRect(
        x + 4,
        y + 4,
        Math.max(1, width - 8),
        Math.max(1, Math.round(height * 0.28)),
        Math.max(1, capRadius - 2)
      );
      stick.endFill();
      stick.hitArea = new PIXI.RoundedRectangle(x, y, width, height, capRadius);
      chunk.container.addChild(stick);

      const surface = { x, y, width, height, radius: capRadius, chunk };
      stickSurfaces.push(surface);
      chunk.stickSurfaces.push(surface);
    }

    function addWindmill(centerX, centerY, scale = 1) {
      const chunk = ensureChunk(getChunkIndex(centerY));
      const bladeLength = getWindmillBladeLength(scale);
      const bladeThickness = Math.max(8, Math.round(12 * scale));
      const hubRadius = Math.max(8, Math.round(10 * scale));
      const wallClearance = getWindmillWallClearance(scale);
      const safeMinX = wallClearance;
      const safeMaxX = MAP_W - wallClearance;
      const spawnX = safeMinX <= safeMaxX ? clamp(centerX, safeMinX, safeMaxX) : Math.round(MAP_W / 2);

      const blades = new PIXI.Container();
      blades.x = spawnX;
      blades.y = centerY;

      const bladeStyle = 0x111111;
      const bladeOffsets = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
      for (const offset of bladeOffsets) {
        const blade = new PIXI.Graphics();
        blade.rotation = offset;
        blade.beginFill(bladeStyle);
        blade.drawRoundedRect(
          -bladeThickness / 2,
          -bladeLength,
          bladeThickness,
          bladeLength,
          bladeThickness / 2
        );
        blade.endFill();
        blades.addChild(blade);
      }

      const hub = new PIXI.Graphics();
      hub.beginFill(0x111111);
      hub.drawCircle(0, 0, hubRadius);
      hub.endFill();
      blades.addChild(hub);

      chunk.container.addChild(blades);
      const windmill = {
        blades,
        centerX: spawnX,
        centerY,
        bladeLength,
        bladeThickness,
        hubRadius,
        bladeOffsets,
        speed: randRange(0.005, 0.01) * (Math.random() < 0.5 ? -1 : 1),
        chunk,
      };
      windmills.push(windmill);
      chunk.windmills.push(windmill);
    }

    function addWallStick(side, y) {
      const x = side === 'left' ? 0 : MAP_W - WALL_STICK_LENGTH;
      addStick(x, Math.round(y), WALL_STICK_LENGTH, STICK_HEIGHT);
    }

    function addWallWindmill(side, y, scale = 1) {
      const wallClearance = getWindmillWallClearance(scale);
      const centerX = side === 'left' ? wallClearance : MAP_W - wallClearance;
      addWindmill(centerX, Math.round(y), scale);
    }

    function addPathStep(y) {
      const width = STICK_LENGTH;
      pathX = addRandomStick(pathX + randRange(-110, 110), Math.round(y), width, STICK_HEIGHT);

      if (Math.random() < 0.14) {
        addRandomStick(
          pathX + randRange(-180, 180),
          Math.round(y - randRange(100, 150)),
          width,
          STICK_HEIGHT
        );
      }

      if (Math.random() < 0.12) {
        const scale = randRange(0.9, 1.08);
        const wallClearance = getWindmillWallClearance(scale);
        const windmillX = clamp(
          pathX + width / 2 + randRange(-90, 90),
          wallClearance,
          MAP_W - wallClearance
        );
        addWindmill(Math.round(windmillX), Math.round(y - randRange(80, 130)), scale);
      }

      if (Math.random() < 0.18) {
        addWallStick('left', y - randRange(20, 120));
      }
      if (Math.random() < 0.18) {
        addWallStick('right', y - randRange(20, 120));
      }
      if (Math.random() < 0.08) {
        addWallWindmill('left', y - randRange(80, 160), randRange(0.85, 1.02));
      }
      if (Math.random() < 0.08) {
        addWallWindmill('right', y - randRange(80, 160), randRange(0.85, 1.02));
      }
    }

    function ensureGeneratedAbove(targetY) {
      while (nextSpawnY > targetY) {
        addPathStep(nextSpawnY);
        nextSpawnY -= randRange(220, 320);
      }
    }

    function updateGrid(cameraTop, cameraBottom, visible) {
      grid.visible = visible;
      grid.clear();
      if (!visible) return;

      const top = Math.floor((cameraTop - GRID * 2) / GRID) * GRID;
      const bottom = Math.ceil((cameraBottom + GRID * 2) / GRID) * GRID;

      grid.lineStyle(1, 0xd8d2c6, 0.7);
      for (let x = 0; x <= MAP_W; x += GRID) {
        grid.moveTo(x, top);
        grid.lineTo(x, bottom);
      }
      for (let y = top; y <= bottom; y += GRID) {
        grid.moveTo(0, y);
        grid.lineTo(MAP_W, y);
      }
    }

    function updateChunkVisibility(cameraTop, cameraBottom) {
      const visibleTop = cameraTop - RENDER_PAD;
      const visibleBottom = cameraBottom + RENDER_PAD;
      for (const chunk of chunks.values()) {
        const visible = chunk.bottom >= visibleTop && chunk.top <= visibleBottom;
        chunk.container.visible = visible;
        chunk.container.renderable = visible;
      }
    }

    function getActiveObjects(cameraTop, cameraBottom) {
      const padTop = cameraTop - RENDER_PAD;
      const padBottom = cameraBottom + RENDER_PAD;
      const activeStickSurfaces = [];
      const activeWindmills = [];

      for (const chunk of chunks.values()) {
        if (chunk.bottom < padTop || chunk.top > padBottom) continue;
        activeStickSurfaces.push(...chunk.stickSurfaces);
        activeWindmills.push(...chunk.windmills);
      }

      return {
        stickSurfaces: activeStickSurfaces,
        windmills: activeWindmills,
      };
    }

    function syncToCamera(cameraTop, cameraBottom, visible = true) {
      ensureGeneratedAbove(cameraTop - GENERATION_PAD);
      updateChunkVisibility(cameraTop, cameraBottom);
      updateGrid(cameraTop, cameraBottom, visible);
      return getActiveObjects(cameraTop, cameraBottom);
    }

    addStick(140, 1840, STICK_LENGTH, STICK_HEIGHT);
    addStick(490, 1500, STICK_LENGTH, STICK_HEIGHT);
    rememberRandomStickX(140);
    rememberRandomStickX(490);
    addWallStick('left', 1710);
    addWallStick('right', 1380);
    addWindmill(190, 1560, 0.95);
    addWindmill(670, 920, 1.05);
    addWallWindmill('left', 1320, 0.9);
    addWallWindmill('right', 760, 1.0);
    ensureGeneratedAbove(GROUND_Y - CHUNK_HEIGHT * 3);

    return { grid, stickSurfaces, windmills, syncToCamera };
  }

  window.UpUpUpMap = { buildMap };
})();
