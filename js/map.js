(() => {
  function createRng(seed) {
    let state = (seed >>> 0) || 0x6d2b79f5;
    return {
      next() {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
    };
  }

  function buildMap({
    PIXI,
    world,
    MAP_W,
    GROUND_Y,
    GRID,
    mode = 'infinite',
    stage = 1,
    seed = 0x12345678,
    collectedCreditIds = [],
    collectedPortalIds = [],
  }) {
    const rng = createRng(seed);
    const collectedCreditIdSet = new Set(collectedCreditIds);
    const collectedPortalIdSet = new Set(collectedPortalIds);
    const isStageOne = mode === 'stage' && stage === 1;
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
    const movingSticks = [];
    const windmills = [];
    const credits = [];
    const portals = [];
    const chunks = new Map();
    const recentSpawns = [];
    const recentStickSpawns = [];
    const recentMovingStickSpawns = [];

    const CHUNK_HEIGHT = GRID * 8;
    const GENERATION_PAD = GRID * 16;
    const RENDER_PAD = GRID * 10;
    const STICK_HEIGHT = 18;
    const STICK_LENGTH = Math.round(210 * 1.33);
    const STICK_MARGIN_X = 48;
    const MOVING_STICK_MARGIN_X = 12;
    const MIN_SPAWN_GAP = Math.round(GRID * 1.2);
    const RECENT_SPAWN_LIMIT = 24;
    const RECENT_STICK_SPAWN_LIMIT = 32;
    const RECENT_MOVING_STICK_SPAWN_LIMIT = 16;
    const ROUTE_STEP_MIN = Math.round(STICK_LENGTH * 0.22);
    const ROUTE_STEP_MAX = Math.round(STICK_LENGTH * 0.38);
    const MAIN_ROUTE_BANDS = 5;
    const STICK_SPAWN_PAD_X = 18;
    const STICK_SPAWN_PAD_Y = 10;
    const MOVING_STICK_Y_GAP = Math.round(GRID * 1.8);
    const WINDMILL_MOVING_STICK_Y_GAP = Math.round(GRID * 3.2);
    const PORTAL_SIZE = 136;
    const STAGE_ONE_STAR_SIZE = 28;
    const CREDIT_SIZE = 20;
    const CREDIT_Y_STEP = GRID * 5;
    const CREDIT_Y_OFFSET_MIN = 42;
    const CREDIT_Y_OFFSET_MAX = 72;
    const SIDE_STICK_CHANCE = 0.12;
    const MOVING_STICK_CHANCE = 0.14;
    const WINDMILL_CHANCE_BASE = 0.05;
    const WINDMILL_CHANCE_MAX = 0.22;
    const WINDMILL_DENSITY_SCORE = 30;

    let nextSpawnY = GROUND_Y - 780;
    let pathX = Math.round(MAP_W * (0.35 + rng.next() * 0.3));
    let routeBandOrder = [];
    let routeBandIndex = 0;
    let lastCreditBucket = Math.floor((GROUND_Y - nextSpawnY) / CREDIT_Y_STEP);

    function randRange(min, max) {
      return min + rng.next() * (max - min);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getWindmillBladeLength(scale = 1) {
      return Math.round(92 * scale * 1.5);
    }

    function getWindmillWallClearance(scale = 1) {
      return getWindmillBladeLength(scale) + 24;
    }

    function getStickSpawnRadius(width, height) {
      return Math.max(96, Math.round(Math.max(width, height) * 0.38));
    }

    function getWindmillSpawnRadius(scale = 1) {
      return Math.max(100, Math.round(getWindmillBladeLength(scale) * 0.58 + 22));
    }

    function drawStickShape(stick, x, y, width, height, capRadius) {
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
    }

    function drawCreditShape(credit, halfSize) {
      const innerSize = Math.max(2, Math.round(halfSize * 0.58));
      credit.lineStyle(3, 0x111111, 1);
      credit.beginFill(0xffdb4d);
      credit.drawPolygon([
        0,
        -halfSize,
        halfSize,
        0,
        0,
        halfSize,
        -halfSize,
        0,
      ]);
      credit.endFill();
      credit.lineStyle(0);
      credit.beginFill(0xfff6a6, 0.9);
      credit.drawPolygon([
        0,
        -innerSize,
        innerSize,
        0,
        0,
        innerSize,
        -innerSize,
        0,
      ]);
      credit.endFill();
    }

    function drawPortalShape(portal, width, height) {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2;
      const starLayer = new PIXI.Container();
      starLayer.x = centerX;
      starLayer.y = centerY;

      function buildStarPoints(outerRadius, innerRadius, points = 5, rotation = -Math.PI / 2) {
        const polygon = [];
        const step = Math.PI / points;
        for (let i = 0; i < points * 2; i++) {
          const angle = rotation + step * i;
          const currentRadius = i % 2 === 0 ? outerRadius : innerRadius;
          polygon.push(Math.cos(angle) * currentRadius, Math.sin(angle) * currentRadius);
        }
        return polygon;
      }

      const starOuter = radius * 0.92;
      const starInner = radius * 0.44;
      const starFill = 0xd4af37;
      const starBorder = 0x5d4300;
      const borderWidth = Math.max(2, Math.round(radius * 0.2));

      const star = new PIXI.Graphics();
      star.lineStyle(borderWidth, starBorder, 1);
      star.beginFill(starFill, 1);
      star.drawPolygon(buildStarPoints(starOuter, starInner));
      star.endFill();
      starLayer.addChild(star);

      portal.addChild(starLayer);
      portal.ringLayer = starLayer;
      portal.radius = radius;
    }

    function getPreferredObstacleSide() {
      return pathX + STICK_LENGTH / 2 < MAP_W / 2 ? 'right' : 'left';
    }

    function getWindmillProgress(y) {
      const estimatedScore = Math.max(0, Math.floor((GROUND_Y - y) / GRID));
      return clamp(estimatedScore / WINDMILL_DENSITY_SCORE, 0, 1);
    }

    function getWindmillSpawnChance(y) {
      const progress = getWindmillProgress(y);
      return WINDMILL_CHANCE_BASE + (WINDMILL_CHANCE_MAX - WINDMILL_CHANCE_BASE) * progress;
    }

    function getWindmillCooldown(y) {
      const progress = getWindmillProgress(y);
      return Math.max(1, 3 - Math.floor(progress * 2));
    }

    function rememberSpawn(spawn) {
      recentSpawns.push(spawn);
      while (recentSpawns.length > RECENT_SPAWN_LIMIT) {
        recentSpawns.shift();
      }
    }

    function rememberStickSpawn(spawn) {
      recentStickSpawns.push(spawn);
      while (recentStickSpawns.length > RECENT_STICK_SPAWN_LIMIT) {
        recentStickSpawns.shift();
      }
    }

    function rememberMovingStickSpawn(spawn) {
      recentMovingStickSpawns.push(spawn);
      while (recentMovingStickSpawns.length > RECENT_MOVING_STICK_SPAWN_LIMIT) {
        recentMovingStickSpawns.shift();
      }
    }

    function getSpawnMargin(x, y, radius) {
      let best = Infinity;
      for (const prev of recentSpawns) {
        const dx = x - prev.x;
        const dy = y - prev.y;
        const minDistance = radius + prev.radius + MIN_SPAWN_GAP;
        best = Math.min(best, Math.hypot(dx, dy) - minDistance);
      }
      return best;
    }

    function scoreCandidate(x, y, radius) {
      if (recentSpawns.length === 0) return Infinity;
      return getSpawnMargin(x, y, radius);
    }

    function isClearFromMovingStickY(y, height) {
      const top = y - MOVING_STICK_Y_GAP;
      const bottom = y + height + MOVING_STICK_Y_GAP;

      for (const prev of recentMovingStickSpawns) {
        const prevTop = prev.y - MOVING_STICK_Y_GAP;
        const prevBottom = prev.y + prev.height + MOVING_STICK_Y_GAP;
        if (!(bottom <= prevTop || top >= prevBottom)) {
          return false;
        }
      }

      return true;
    }

    function isStickSpawnClear(x, y, width, height) {
      const left = x - STICK_SPAWN_PAD_X;
      const right = x + width + STICK_SPAWN_PAD_X;
      const top = y - STICK_SPAWN_PAD_Y;
      const bottom = y + height + STICK_SPAWN_PAD_Y;

      for (const prev of recentStickSpawns) {
        const prevLeft = prev.x - STICK_SPAWN_PAD_X;
        const prevRight = prev.x + prev.width + STICK_SPAWN_PAD_X;
        const prevTop = prev.y - STICK_SPAWN_PAD_Y;
        const prevBottom = prev.y + prev.height + STICK_SPAWN_PAD_Y;
        if (!(right <= prevLeft || left >= prevRight || bottom <= prevTop || top >= prevBottom)) {
          return false;
        }
      }

      return true;
    }

    function scoreStickCandidate(x, y, width, height, radius) {
      if (!isStickSpawnClear(x, y, width, height)) return -Infinity;
      if (!isClearFromMovingStickY(y, height)) return -Infinity;
      return scoreCandidate(x + width / 2, y + height / 2, radius);
    }

    function isWindmillClearFromMovingStick(y, radius) {
      const top = y - radius - WINDMILL_MOVING_STICK_Y_GAP;
      const bottom = y + radius + WINDMILL_MOVING_STICK_Y_GAP;

      for (const prev of recentMovingStickSpawns) {
        const prevTop = prev.y - WINDMILL_MOVING_STICK_Y_GAP;
        const prevBottom = prev.y + prev.height + WINDMILL_MOVING_STICK_Y_GAP;
        if (!(bottom <= prevTop || top >= prevBottom)) {
          return false;
        }
      }

      return true;
    }

    function scoreWindmillCandidate(x, y, radius) {
      if (!isWindmillClearFromMovingStick(y, radius)) return -Infinity;
      const routeCenter = pathX + STICK_LENGTH / 2;
      const distanceFromRoute = Math.abs(x - routeCenter);
      const routePenalty = Math.max(0, 190 - distanceFromRoute) * 0.6;
      return scoreCandidate(x, y, radius) - routePenalty;
    }

    function refillRouteBandOrder() {
      routeBandOrder = Array.from({ length: MAIN_ROUTE_BANDS }, (_, i) => i);
      for (let i = routeBandOrder.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [routeBandOrder[i], routeBandOrder[j]] = [routeBandOrder[j], routeBandOrder[i]];
      }
      routeBandIndex = 0;
    }

    function getNextRouteBand() {
      if (routeBandOrder.length === 0 || routeBandIndex >= routeBandOrder.length) {
        refillRouteBandOrder();
      }
      const band = routeBandOrder[routeBandIndex];
      routeBandIndex += 1;
      return band;
    }

    function pickMainStickX(y, width, height) {
      const radius = getStickSpawnRadius(width, height);
      const minX = STICK_MARGIN_X;
      const maxX = MAP_W - width - STICK_MARGIN_X;
      const minStep = Math.min(ROUTE_STEP_MIN, Math.max(16, maxX - minX));
      const maxStep = Math.min(ROUTE_STEP_MAX, Math.max(minStep, maxX - minX));
      const span = Math.max(1, maxX - minX);
      const bandWidth = span / MAIN_ROUTE_BANDS;
      const routeBand = getNextRouteBand();
      const routeCenter = minX + bandWidth * (routeBand + 0.5);
      const routeJitter = Math.min(GRID * 1.2, bandWidth * 0.32);
      const bandCandidate = clamp(routeCenter + randRange(-routeJitter, routeJitter), minX, maxX);
      let bestX = Math.round(bandCandidate);
      let bestScore = -Infinity;

      const randomCandidate = clamp(randRange(minX, maxX), minX, maxX);
      const continuityCandidate = clamp(pathX + randRange(-maxStep, maxStep), minX, maxX);
      const anchorCandidates = [
        bandCandidate,
        continuityCandidate,
        clamp(bandCandidate - bandWidth * 0.35, minX, maxX),
        clamp(bandCandidate + bandWidth * 0.35, minX, maxX),
        randomCandidate,
      ];

      for (const candidate of anchorCandidates) {
        const score = scoreStickCandidate(candidate, y, width, height, radius);
        if (score >= 0) {
          pathX = Math.round(candidate);
          return pathX;
        }
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(candidate);
        }
      }

      for (let i = 0; i < 28; i++) {
        const step = randRange(minStep, maxStep) * (rng.next() < 0.5 ? -1 : 1);
        const candidate = clamp(pathX + step, minX, maxX);
        const score = scoreStickCandidate(candidate, y, width, height, radius);
        if (score >= 0) {
          pathX = Math.round(candidate);
          return pathX;
        }
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(candidate);
        }
      }

      const anchors = [
        clamp(pathX - maxStep, minX, maxX),
        clamp(pathX - minStep * 0.5, minX, maxX),
        clamp(pathX, minX, maxX),
        clamp(pathX + minStep * 0.5, minX, maxX),
        clamp(pathX + maxStep, minX, maxX),
      ];

      for (const anchor of anchors) {
        const score = scoreStickCandidate(anchor, y, width, height, radius);
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(anchor);
        }
      }

      pathX = bestX;
      return bestX;
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
        movingSticks: [],
        windmills: [],
        credits: [],
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
      drawStickShape(stick, x, y, width, height, capRadius);
      stick.hitArea = new PIXI.RoundedRectangle(x, y, width, height, capRadius);
      chunk.container.addChild(stick);

      const surface = { x, y, width, height, radius: capRadius, chunk, deltaX: 0 };
      stickSurfaces.push(surface);
      chunk.stickSurfaces.push(surface);
      rememberStickSpawn({
        kind: 'stick',
        x,
        y,
        width,
        height,
      });
      rememberSpawn({
        kind: 'stick',
        x: x + width / 2,
        y: y + height / 2,
        radius: getStickSpawnRadius(width, height),
      });
      return surface;
    }

    function addMovingStick(y, width = Math.round(STICK_LENGTH * randRange(0.58, 0.82)), height = STICK_HEIGHT) {
      const chunk = ensureChunk(getChunkIndex(y));
      const capRadius = Math.max(1, Math.round(height * 0.5));
      const baseX = pickStickX(y, width, height, getPreferredObstacleSide());
      const minX = MOVING_STICK_MARGIN_X;
      const maxX = MAP_W - width - MOVING_STICK_MARGIN_X;
      const direction = rng.next() < 0.5 ? -1 : 1;
      const speed = randRange(0.9, 1.7) * direction;
      const stick = new PIXI.Graphics();
      drawStickShape(stick, 0, 0, width, height, capRadius);
      stick.x = Math.round(baseX);
      stick.y = Math.round(y);
      stick.hitArea = new PIXI.RoundedRectangle(0, 0, width, height, capRadius);
      chunk.container.addChild(stick);

      const surface = {
        x: Math.round(baseX),
        y: Math.round(y),
        width,
        height,
        radius: capRadius,
        chunk,
        gfx: stick,
        minX,
        maxX,
        speed,
        prevX: Math.round(baseX),
        deltaX: 0,
      };
      stickSurfaces.push(surface);
      movingSticks.push(surface);
      chunk.stickSurfaces.push(surface);
      chunk.movingSticks.push(surface);
      rememberMovingStickSpawn({
        x: surface.x + width / 2,
        y: surface.y,
        width,
        height,
      });
      rememberStickSpawn({
        kind: 'moving-stick',
        x: surface.x,
        y: surface.y,
        width,
        height,
      });
      rememberSpawn({
        kind: 'moving-stick',
        x: surface.x + width / 2,
        y: surface.y + height / 2,
        radius: getStickSpawnRadius(width, height),
      });
      return surface;
    }

    function addSideStick(y, width = STICK_LENGTH, height = STICK_HEIGHT) {
      const x = pickStickX(y, width, height, getPreferredObstacleSide());
      const radius = getStickSpawnRadius(width, height);
      const score = scoreStickCandidate(x, y, width, height, radius);
      if (score < 0) return false;
      addStick(x, Math.round(y), width, height);
      return true;
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
        speed: randRange(0.005, 0.01) * (rng.next() < 0.5 ? -1 : 1),
        chunk,
      };
      windmills.push(windmill);
      chunk.windmills.push(windmill);
      rememberSpawn({
        kind: 'windmill',
        x: spawnX,
        y: centerY,
        radius: getWindmillSpawnRadius(scale),
      });
      return windmill;
    }

    function pickStickX(y, width, height, preferredSide = null) {
      const radius = getStickSpawnRadius(width, height);
      const minX = STICK_MARGIN_X;
      const maxX = MAP_W - width - STICK_MARGIN_X;
      const laneSplit = MAP_W / 2;
      const laneOffset = Math.max(24, STICK_MARGIN_X * 0.75);
      const preferredMin =
        preferredSide === 'right'
          ? Math.max(minX, Math.round(laneSplit + laneOffset))
          : minX;
      const preferredMax =
        preferredSide === 'left'
          ? Math.min(maxX, Math.round(laneSplit - width - laneOffset))
          : maxX;
      const searchMin = Math.min(preferredMin, preferredMax);
      const searchMax = Math.max(preferredMin, preferredMax);
      const usableMin = searchMax - searchMin > 12 ? searchMin : minX;
      const usableMax = searchMax - searchMin > 12 ? searchMax : maxX;
      let bestX = Math.round((usableMin + usableMax) / 2);
      let bestScore = -Infinity;

      for (let i = 0; i < 28; i++) {
        const candidate = clamp(randRange(usableMin, usableMax), usableMin, usableMax);
        const score = scoreCandidate(candidate + width / 2, y + height / 2, radius);
        if (score >= 0) return Math.round(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(candidate);
        }
      }

      const anchors = [
        usableMin,
        usableMin + (usableMax - usableMin) * 0.2,
        usableMin + (usableMax - usableMin) * 0.4,
        usableMin + (usableMax - usableMin) * 0.6,
        usableMin + (usableMax - usableMin) * 0.8,
        usableMax,
      ];

      for (const anchor of anchors) {
        const score = scoreCandidate(anchor + width / 2, y + height / 2, radius);
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(anchor);
        }
      }

      return bestX;
    }

    function pickWindmillCenterX(y, scale = 1, preferredSide = null) {
      const radius = getWindmillSpawnRadius(scale);
      const wallClearance = getWindmillWallClearance(scale);
      const minX = wallClearance;
      const maxX = MAP_W - wallClearance;
      const laneSplit = MAP_W / 2;
      const laneOffset = Math.max(36, wallClearance * 0.55);
      const preferredMin =
        preferredSide === 'right'
          ? Math.max(minX, Math.round(laneSplit + laneOffset))
          : minX;
      const preferredMax =
        preferredSide === 'left'
          ? Math.min(maxX, Math.round(laneSplit - laneOffset))
          : maxX;
      const searchMin = Math.min(preferredMin, preferredMax);
      const searchMax = Math.max(preferredMin, preferredMax);
      const usableMin = searchMax - searchMin > 24 ? searchMin : minX;
      const usableMax = searchMax - searchMin > 24 ? searchMax : maxX;
      let bestX = Math.round((usableMin + usableMax) / 2);
      let bestScore = -Infinity;

      for (let i = 0; i < 28; i++) {
        const candidate = clamp(randRange(usableMin, usableMax), usableMin, usableMax);
        const score = scoreWindmillCandidate(candidate, y, radius);
        if (score >= 0) return Math.round(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(candidate);
        }
      }

      const anchors = [
        usableMin,
        usableMin + (usableMax - usableMin) * 0.25,
        usableMin + (usableMax - usableMin) * 0.5,
        usableMin + (usableMax - usableMin) * 0.75,
        usableMax,
      ];

      for (const anchor of anchors) {
        const score = scoreWindmillCandidate(anchor, y, radius);
        if (score > bestScore) {
          bestScore = score;
          bestX = Math.round(anchor);
        }
      }

      return bestX;
    }

    function spawnRandomStick(y, width = STICK_LENGTH, height = STICK_HEIGHT) {
      const x = pickMainStickX(y, width, height);
      addStick(x, Math.round(y), width, height);
      return x;
    }

    function spawnRandomWindmill(y, scale = randRange(0.9, 1.08)) {
      const centerX = pickWindmillCenterX(y, scale, getPreferredObstacleSide());
      addWindmill(centerX, Math.round(y), scale);
      return centerX;
    }

    function spawnRandomMovingStick(y, width = Math.round(STICK_LENGTH * randRange(0.58, 0.82)), height = STICK_HEIGHT) {
      return addMovingStick(Math.round(y), width, height).x;
    }

    function addCredit(x, y) {
      const halfSize = CREDIT_SIZE / 2;
      const hitRadius = Math.round(halfSize * 0.75);
      const chunk = ensureChunk(getChunkIndex(y));
      const credit = new PIXI.Graphics();
      drawCreditShape(credit, halfSize);
      credit.x = Math.round(x);
      credit.y = Math.round(y);
      chunk.container.addChild(credit);

      const item = {
        id: credits.length,
        x: Math.round(x),
        y: Math.round(y),
        halfSize,
        hitRadius,
        collected: false,
        chunk,
        gfx: credit,
      };

      credits.push(item);
      if (collectedCreditIdSet.has(item.id)) {
        item.collected = true;
        credit.visible = false;
        credit.renderable = false;
      }
      if (!chunk.credits) {
        chunk.credits = [];
      }
      chunk.credits.push(item);
      rememberSpawn({
        kind: 'credit',
        x: item.x,
        y: item.y,
        radius: Math.round(halfSize * 1.1),
      });
      return item;
    }

    function addPortal(x, y, width = PORTAL_SIZE, height = PORTAL_SIZE) {
      const chunk = ensureChunk(getChunkIndex(y));
      const portal = new PIXI.Container();
      drawPortalShape(portal, width, height);
      const centerX = Math.round(x + width / 2);
      const centerY = Math.round(y + height / 2);
      portal.x = Math.round(x);
      portal.y = Math.round(y);
      chunk.container.addChild(portal);

      const item = {
        id: portals.length,
        x: Math.round(x),
        y: Math.round(y),
        width,
        height,
        centerX,
        centerY,
        radius: Math.max(width, height) / 2,
        collected: false,
        chunk,
        gfx: portal,
        phase: rng.next() * Math.PI * 2,
        pulseSpeed: 1.8 + rng.next() * 0.7,
        pulseAmplitude: 0.055 + rng.next() * 0.02,
      };

      portals.push(item);
      if (collectedPortalIdSet.has(item.id)) {
        item.collected = true;
        portal.visible = false;
        portal.renderable = false;
      }
      if (!chunk.portals) {
        chunk.portals = [];
      }
      chunk.portals.push(item);
      rememberSpawn({
        kind: 'portal',
        x: item.centerX,
        y: item.centerY,
        radius: item.radius,
      });
      return item;
    }

    function spawnRandomCredit(y, anchorX, width = STICK_LENGTH) {
      const x = clamp(
        anchorX + randRange(-width * 0.12, width * 0.12),
        STICK_MARGIN_X,
        MAP_W - STICK_MARGIN_X
      );
      const creditY = Math.round(y - randRange(CREDIT_Y_OFFSET_MIN, CREDIT_Y_OFFSET_MAX));
      return addCredit(x, creditY).x;
    }

    function shouldSpawnCredit(y) {
      const bucket = Math.floor((GROUND_Y - y) / CREDIT_Y_STEP);
      if (bucket <= lastCreditBucket) return false;
      lastCreditBucket = bucket;
      return true;
    }

    let movingStickCooldown = 0;
    let windmillCooldown = 0;

    function addSpawnStep(y) {
      const mainStickWidth = STICK_LENGTH;
      const mainStickX = spawnRandomStick(y, mainStickWidth, STICK_HEIGHT);

      if (shouldSpawnCredit(y)) {
        spawnRandomCredit(y, mainStickX, mainStickWidth);
      }

      if (movingStickCooldown > 0) {
        movingStickCooldown -= 1;
      }

      if (windmillCooldown > 0) {
        windmillCooldown -= 1;
      }

      let spawnedAccent = false;
      const windmillProgress = getWindmillProgress(y);

      if (movingStickCooldown === 0 && rng.next() < MOVING_STICK_CHANCE) {
        spawnRandomMovingStick(
          y - randRange(150, 210),
          Math.round(STICK_LENGTH * randRange(0.58, 0.78)),
          STICK_HEIGHT
        );
        movingStickCooldown = 2;
        spawnedAccent = true;
      } else if (windmillCooldown === 0 && rng.next() < getWindmillSpawnChance(y)) {
        const windmillY = y - randRange(110, 170);
        spawnRandomWindmill(windmillY, randRange(0.92, 1.08));
        windmillCooldown = getWindmillCooldown(y);
        spawnedAccent = true;

        if (windmillProgress > 0.55 && rng.next() < (windmillProgress - 0.55) * 0.75) {
          spawnRandomWindmill(windmillY - randRange(70, 120), randRange(0.86, 1.02));
        }
      }

      if (!spawnedAccent && rng.next() < SIDE_STICK_CHANCE) {
        addSideStick(
          y - randRange(100, 160),
          Math.round(STICK_LENGTH * randRange(0.82, 1)),
          STICK_HEIGHT
        );
      }
    }

    function createStageOneLayout() {
      const lowerToHalfHeight = (y) => Math.round(GROUND_Y - (GROUND_Y - y) * 0.5);
      const stickY = lowerToHalfHeight(GROUND_Y - 580);
      const stickX = 128;
      const stickWidth = 644;
      addStick(stickX, stickY, stickWidth, STICK_HEIGHT);
      const starSize = STAGE_ONE_STAR_SIZE;
      const halfStar = starSize / 2;
      const centerStarX = Math.round(MAP_W / 2 - halfStar);
      const leftStarX = Math.round(MAP_W / 2 - 150 - halfStar);
      const rightStarX = Math.round(MAP_W / 2 + 150 - halfStar);
      const lowerStarY = Math.round(stickY - 84);
      const upperStarY = Math.round(stickY - 186);
      addPortal(leftStarX, lowerStarY, starSize, starSize);
      addPortal(centerStarX, upperStarY, starSize, starSize);
      addPortal(rightStarX, lowerStarY, starSize, starSize);
    }

    function seedInitialObjects() {
      if (isStageOne) {
        createStageOneLayout();
        return;
      }

      let y = GROUND_Y - randRange(220, 280);
      for (let i = 0; i < 4; i++) {
        addSpawnStep(Math.round(y));
        y -= randRange(220, 320);
      }
    }

    function ensureGeneratedAbove(targetY) {
      if (isStageOne) return;
      while (nextSpawnY > targetY) {
        addSpawnStep(nextSpawnY);
        nextSpawnY -= randRange(220, 320);
      }
    }

    function updateMovingSticks() {
      for (const stick of movingSticks) {
        stick.prevX = stick.x;
        stick.x += stick.speed;
        if (stick.x <= stick.minX) {
          stick.x = stick.minX;
          stick.speed = Math.abs(stick.speed);
        } else if (stick.x >= stick.maxX) {
          stick.x = stick.maxX;
          stick.speed = -Math.abs(stick.speed);
        }
        stick.deltaX = stick.x - stick.prevX;
        stick.gfx.x = stick.x;
        stick.gfx.y = stick.y;
      }
    }

    function collectCredit(credit) {
      if (!credit || credit.collected) return false;
      credit.collected = true;
      collectedCreditIdSet.add(credit.id);
      if (credit.gfx) {
        credit.gfx.visible = false;
        credit.gfx.renderable = false;
      }
      return true;
    }

    function getVisibleChunkRange(cameraTop, cameraBottom) {
      return {
        minIndex: Math.floor((cameraTop - RENDER_PAD) / CHUNK_HEIGHT),
        maxIndex: Math.floor((cameraBottom + RENDER_PAD) / CHUNK_HEIGHT),
      };
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

    let lastVisibleMinIndex = null;
    let lastVisibleMaxIndex = null;
    let lastActiveRangeKey = null;
    let lastActiveObjects = {
      stickSurfaces: [],
      windmills: [],
      credits: [],
      portals: [],
    };

    function updateChunkVisibility(minIndex, maxIndex) {
      if (lastVisibleMinIndex === minIndex && lastVisibleMaxIndex === maxIndex) {
        return;
      }

      const nextVisible = new Set();
      for (let index = minIndex; index <= maxIndex; index++) {
        const chunk = chunks.get(index);
        if (!chunk) continue;
        chunk.container.visible = true;
        chunk.container.renderable = true;
        nextVisible.add(index);
      }

      if (lastVisibleMinIndex != null && lastVisibleMaxIndex != null) {
        for (let index = lastVisibleMinIndex; index <= lastVisibleMaxIndex; index++) {
          if (nextVisible.has(index)) continue;
          const chunk = chunks.get(index);
          if (!chunk) continue;
          chunk.container.visible = false;
          chunk.container.renderable = false;
        }
      }

      lastVisibleMinIndex = minIndex;
      lastVisibleMaxIndex = maxIndex;
    }

    function getActiveObjectsForRange(minIndex, maxIndex) {
      const rangeKey = `${minIndex}:${maxIndex}`;
      if (rangeKey === lastActiveRangeKey) {
        return lastActiveObjects;
      }

      const activeStickSurfaces = [];
      const activeWindmills = [];
      const activeCredits = [];
      const activePortals = [];

      for (let index = minIndex; index <= maxIndex; index++) {
        const chunk = chunks.get(index);
        if (!chunk) continue;
        activeStickSurfaces.push(...chunk.stickSurfaces);
        activeWindmills.push(...chunk.windmills);
        if (chunk.credits) {
          activeCredits.push(...chunk.credits);
        }
        if (chunk.portals) {
          activePortals.push(...chunk.portals);
        }
      }

      lastActiveRangeKey = rangeKey;
      lastActiveObjects = {
        stickSurfaces: activeStickSurfaces,
        windmills: activeWindmills,
        credits: activeCredits,
        portals: activePortals,
      };
      return lastActiveObjects;
    }

    function syncToCamera(cameraTop, cameraBottom, visible = true) {
      ensureGeneratedAbove(cameraTop - GENERATION_PAD);
      const { minIndex, maxIndex } = getVisibleChunkRange(cameraTop, cameraBottom);
      updateChunkVisibility(minIndex, maxIndex);
      updateGrid(cameraTop, cameraBottom, visible);
      return getActiveObjectsForRange(minIndex, maxIndex);
    }

    function generateTo(targetY) {
      ensureGeneratedAbove(targetY);
    }

    function getState() {
      return {
        seed,
        nextSpawnY,
        pathX,
        collectedCreditIds: credits.filter((credit) => credit.collected).map((credit) => credit.id),
        collectedPortalIds: portals.filter((portal) => portal.collected).map((portal) => portal.id),
      };
    }

    seedInitialObjects();
    if (!isStageOne) {
      if (movingSticks.length === 0) {
        spawnRandomMovingStick(GROUND_Y - randRange(300, 440), Math.round(STICK_LENGTH * randRange(0.62, 0.78)), STICK_HEIGHT);
      }
      if (windmills.length === 0) {
        spawnRandomWindmill(GROUND_Y - randRange(420, 560), randRange(0.94, 1.04));
      }
      ensureGeneratedAbove(GROUND_Y - CHUNK_HEIGHT * 3);
    }

    return {
      grid,
      stickSurfaces,
      movingSticks,
      windmills,
      credits,
      portals,
      syncToCamera,
      generateTo,
      getState,
      updateMovingSticks,
      collectCredit,
    };
  }

  window.UpUpUpMap = { buildMap };
})();
