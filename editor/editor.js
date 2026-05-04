(() => {
  const {
    readStageEditorDraft,
    writeStageEditorDraft,
    writeStageEditorStage,
  } = window.UpUpUpShared;
  const DEFAULT_MAP_WIDTH = 900;
  const DEFAULT_GROUND_Y = 2040;
  const GRID_SIZE = 60;
  const MIN_STAGE_HEIGHT = 2400;
  const DEFAULT_STICK_HEIGHT = 18;
  const DEFAULT_PORTAL_SIZE = 28;
  const DEFAULT_MOVING_STICK_WIDTH = 240;
  const DEFAULT_MOVING_STICK_SPEED = 1.2;
  const DEFAULT_MOVING_STICK_DIRECTION = 'right';
  const DEFAULT_WINDMILL_SIZE = 280;

  const canvas = document.getElementById('stage-canvas');
  const canvasScroll = document.getElementById('canvas-scroll');
  const panelRight = document.querySelector('.panel-right');
  const ctx = canvas.getContext('2d');

  const refs = {
    status: document.getElementById('editor-status'),
    objectList: document.getElementById('object-list'),
    stageName: document.getElementById('stage-name-input'),
    stageNumber: document.getElementById('stage-number-input'),
    mapWidth: document.getElementById('map-width-input'),
    groundY: document.getElementById('ground-y-input'),
    objectType: document.getElementById('object-type-input'),
    objectId: document.getElementById('object-id-input'),
    objectX: document.getElementById('object-x-input'),
    objectY: document.getElementById('object-y-input'),
    objectWidth: document.getElementById('object-width-input'),
    objectHeight: document.getElementById('object-height-input'),
    objectSpeed: document.getElementById('object-speed-input'),
    objectDirection: document.getElementById('object-direction-input'),
    jsonOutput: document.getElementById('json-output'),
    importFile: document.getElementById('import-file-input'),
    loadSampleBtn: document.getElementById('load-sample-btn'),
    resetBtn: document.getElementById('reset-btn'),
    saveLocalBtn: document.getElementById('save-local-btn'),
    addStickBtn: document.getElementById('add-stick-btn'),
    addStarBtn: document.getElementById('add-star-btn'),
    addMovingStickBtn: document.getElementById('add-moving-stick-btn'),
    addWindmillBtn: document.getElementById('add-windmill-btn'),
    duplicateBtn: document.getElementById('duplicate-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    downloadBtn: document.getElementById('download-btn'),
    copyBtn: document.getElementById('copy-btn'),
    applyJsonBtn: document.getElementById('apply-json-btn'),
  };

  const state = {
    stageData: createSampleStage(),
    selectedId: null,
    dragging: null,
    panning: null,
    dirty: false,
    scale: 1,
    viewX: 0,
    viewY: 0,
    visibleWorldWidth: 0,
    visibleWorldHeight: 0,
    persistTimer: null,
  };

  function createId(prefix = 'obj') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeDirection(value, fallback = DEFAULT_MOVING_STICK_DIRECTION) {
    const direction = String(value || '').toLowerCase();
    if (direction === 'left' || direction === 'right') {
      return direction;
    }
    return fallback;
  }

  function canScrollVertically(element, deltaY) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    if (overflowY !== 'auto' && overflowY !== 'scroll') {
      return false;
    }
    if (element.scrollHeight <= element.clientHeight) {
      return false;
    }
    if (deltaY < 0) {
      return element.scrollTop > 0;
    }
    if (deltaY > 0) {
      return element.scrollTop + element.clientHeight < element.scrollHeight;
    }
    return false;
  }

  function clone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function createSampleStage() {
    return {
      version: 1,
      stage: 1,
      name: '스테이지 1',
      settings: {
        mapWidth: DEFAULT_MAP_WIDTH,
        groundY: DEFAULT_GROUND_Y,
        gridSize: GRID_SIZE,
      },
      objects: [
        {
          id: 'stick-start',
          type: 'stick',
          x: 128,
          y: 1750,
          width: 644,
          height: DEFAULT_STICK_HEIGHT,
        },
        {
          id: 'star-left',
          type: 'star',
          x: 286,
          y: 1666,
          width: DEFAULT_PORTAL_SIZE,
          height: DEFAULT_PORTAL_SIZE,
        },
        {
          id: 'star-center',
          type: 'star',
          x: 436,
          y: 1564,
          width: DEFAULT_PORTAL_SIZE,
          height: DEFAULT_PORTAL_SIZE,
        },
        {
          id: 'star-right',
          type: 'star',
          x: 586,
          y: 1666,
          width: DEFAULT_PORTAL_SIZE,
          height: DEFAULT_PORTAL_SIZE,
        },
      ],
    };
  }

  function createBlankStage() {
    return {
      version: 1,
      stage: 1,
      name: '새 스테이지',
      settings: {
        mapWidth: DEFAULT_MAP_WIDTH,
        groundY: DEFAULT_GROUND_Y,
        gridSize: GRID_SIZE,
      },
      objects: [],
    };
  }

  function getTypeDefaults(type) {
    if (type === 'star' || type === 'portal') {
      return { type: 'star', width: DEFAULT_PORTAL_SIZE, height: DEFAULT_PORTAL_SIZE };
    }
    if (type === 'windmill') {
      return { type: 'windmill', width: DEFAULT_WINDMILL_SIZE, height: DEFAULT_WINDMILL_SIZE };
    }
    if (type === 'moving-stick' || type === 'movingStick') {
      return { type: 'moving-stick', width: DEFAULT_MOVING_STICK_WIDTH, height: DEFAULT_STICK_HEIGHT };
    }
    return { type: 'stick', width: DEFAULT_MOVING_STICK_WIDTH, height: DEFAULT_STICK_HEIGHT };
  }

  function normalizeObject(input = {}, index = 0) {
    const defaults = getTypeDefaults(input.type);
    const type = defaults.type;

    const object = {
      id: String(input.id || createId(type)),
      type,
      x: Math.round(numberOr(input.x, 100 + index * 24)),
      y: Math.round(numberOr(input.y, 1400 + index * 24)),
      width: Math.max(1, Math.round(numberOr(input.width, defaults.width))),
      height: Math.max(1, Math.round(numberOr(input.height, defaults.height))),
    };

    if (type === 'star') {
      object.width = Math.max(1, Math.round(numberOr(input.width, DEFAULT_PORTAL_SIZE)));
      object.height = Math.max(1, Math.round(numberOr(input.height, DEFAULT_PORTAL_SIZE)));
    } else if (type === 'windmill') {
      object.width = Math.max(1, Math.round(numberOr(input.width, DEFAULT_WINDMILL_SIZE)));
      object.height = Math.max(1, Math.round(numberOr(input.height, DEFAULT_WINDMILL_SIZE)));
      if (Number.isFinite(Number(input.rotationSpeed))) {
        object.rotationSpeed = Number(input.rotationSpeed);
      }
    } else if (type === 'moving-stick') {
      object.width = Math.max(1, Math.round(numberOr(input.width, DEFAULT_MOVING_STICK_WIDTH)));
      object.height = Math.max(1, Math.round(numberOr(input.height, DEFAULT_STICK_HEIGHT)));
      const rawSpeed = Number(input.speed);
      const hasSpeed = Number.isFinite(rawSpeed) && rawSpeed !== 0;
      object.speed = hasSpeed ? Math.max(0.1, Math.abs(rawSpeed)) : DEFAULT_MOVING_STICK_SPEED;
      object.direction = normalizeDirection(
        input.direction,
        hasSpeed && rawSpeed < 0 ? 'left' : DEFAULT_MOVING_STICK_DIRECTION
      );
    }

    return object;
  }

  function normalizeStageData(raw) {
    const stageNumber = Math.max(1, Math.floor(numberOr(raw?.stage, 1)));
    const mapWidth = Math.max(200, Math.round(numberOr(raw?.settings?.mapWidth, DEFAULT_MAP_WIDTH)));
    const groundY = Math.max(0, Math.round(numberOr(raw?.settings?.groundY, DEFAULT_GROUND_Y)));
    const gridSize = Math.max(1, Math.round(numberOr(raw?.settings?.gridSize, GRID_SIZE)));

    return {
      version: 1,
      stage: stageNumber,
      name: String(raw?.name || `스테이지 ${stageNumber}`),
      settings: {
        mapWidth,
        groundY,
        gridSize,
      },
      objects: Array.isArray(raw?.objects)
        ? raw.objects.map((object, index) => normalizeObject(object, index))
        : [],
    };
  }

  function getStageHeight() {
    const groundY = state.stageData.settings.groundY;
    const maxBottom = state.stageData.objects.reduce((max, object) => {
      return Math.max(max, object.y + object.height);
    }, 0);
    return Math.max(MIN_STAGE_HEIGHT, groundY + 220, maxBottom + 220);
  }

  function getSelectedObject() {
    return state.stageData.objects.find((object) => object.id === state.selectedId) || null;
  }

  function setStatus(message) {
    refs.status.textContent = message;
  }

  function markDirty(message = '저장되지 않은 변경 사항이 있습니다.') {
    state.dirty = true;
    if (message) {
      setStatus(message);
    }
    schedulePersist();
  }

  function schedulePersist() {
    if (state.persistTimer) {
      window.clearTimeout(state.persistTimer);
    }
    state.persistTimer = window.setTimeout(() => {
      persistDraft();
      state.persistTimer = null;
    }, 250);
  }

  function persistDraft() {
    try {
      const draftSaved = writeStageEditorDraft(state.stageData);
      const stageSaved = writeStageEditorStage(state.stageData.stage, state.stageData);
      if (!draftSaved || !stageSaved) {
        return false;
      }
      state.dirty = false;
      return true;
    } catch {
      // Ignore storage failures in private browsing or blocked storage contexts.
      return false;
    }
  }

  function loadDraft() {
    try {
      const raw = readStageEditorDraft?.();
      if (!raw) return false;
      state.stageData = normalizeStageData(raw);
      state.selectedId = state.stageData.objects[0]?.id ?? null;
      state.dirty = false;
      return true;
    } catch {
      return false;
    }
  }

  function formatJson() {
    return JSON.stringify(state.stageData, null, 2);
  }

  function syncMetaInputs() {
    refs.stageName.value = state.stageData.name;
    refs.stageNumber.value = String(state.stageData.stage);
    refs.mapWidth.value = String(state.stageData.settings.mapWidth);
    refs.groundY.value = String(state.stageData.settings.groundY);
  }

  function syncSelectedInputs() {
    const object = getSelectedObject();
    const isMovingStick = object?.type === 'moving-stick';

    refs.objectId.value = object ? object.id : '';
    refs.objectType.value = object ? object.type : 'stick';
    refs.objectX.value = object ? String(object.x) : '';
    refs.objectY.value = object ? String(object.y) : '';
    refs.objectWidth.value = object ? String(object.width) : '';
    refs.objectHeight.value = object ? String(object.height) : '';
    refs.objectSpeed.value = object && isMovingStick ? String(object.speed) : '';
    refs.objectDirection.value = object && isMovingStick ? object.direction : DEFAULT_MOVING_STICK_DIRECTION;

    const disabled = !object;
    refs.objectType.disabled = disabled;
    refs.objectX.disabled = disabled;
    refs.objectY.disabled = disabled;
    refs.objectWidth.disabled = disabled;
    refs.objectHeight.disabled = disabled;
    refs.objectSpeed.disabled = disabled || !isMovingStick;
    refs.objectDirection.disabled = disabled || !isMovingStick;
    refs.duplicateBtn.disabled = disabled;
    refs.deleteBtn.disabled = disabled;
  }

  function syncJsonOutput(force = false) {
    if (!force && document.activeElement === refs.jsonOutput) {
      return;
    }
    refs.jsonOutput.value = formatJson();
  }

  function renderObjectList() {
    refs.objectList.innerHTML = '';

    if (state.stageData.objects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'object-row';
      empty.innerHTML = `
        <span class="object-type">비어 있음</span>
        <span class="object-meta">기둥이나 포탈을 추가해서 스테이지를 시작하세요.</span>
      `;
      refs.objectList.appendChild(empty);
      return;
    }

    state.stageData.objects.forEach((object, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'object-row';
      if (object.id === state.selectedId) {
        button.classList.add('is-selected');
      }
      button.dataset.objectId = object.id;
      const extraMeta =
        object.type === 'moving-stick'
          ? ` / 속력:${object.speed} / 방향:${object.direction === 'left' ? '왼쪽' : '오른쪽'}`
          : '';
      button.innerHTML = `
        <span class="object-type">${object.type}</span>
        <strong>#${String(index + 1).padStart(2, '0')} ${object.id}</strong>
        <span class="object-meta">x:${object.x} y:${object.y} w:${object.width} h:${object.height}${extraMeta}</span>
      `;
      refs.objectList.appendChild(button);
    });
  }

  function resizeCanvas() {
    const mapWidth = state.stageData.settings.mapWidth;
    const cssWidth = Math.max(320, canvasScroll.clientWidth - 2);
    const scale = cssWidth / mapWidth;
    const stageHeight = getStageHeight();
    const cssHeight = Math.max(240, canvasScroll.clientHeight - 2);
    const dpr = window.devicePixelRatio || 1;

    state.scale = scale;
    state.visibleWorldWidth = cssWidth / scale;
    state.visibleWorldHeight = cssHeight / scale;
    state.viewX = clamp(state.viewX, 0, Math.max(0, mapWidth - state.visibleWorldWidth));
    state.viewY = clamp(state.viewY, 0, Math.max(0, stageHeight - state.visibleWorldHeight));

    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function worldXToCanvas(value) {
    return (value - state.viewX) * state.scale;
  }

  function worldYToCanvas(value) {
    return (value - state.viewY) * state.scale;
  }

  function drawGrid(stageHeight) {
    const mapWidth = state.stageData.settings.mapWidth;
    const grid = state.stageData.settings.gridSize;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const startX = Math.floor(state.viewX / grid) * grid;
    const endX = Math.min(mapWidth, state.viewX + state.visibleWorldWidth + grid);
    const startY = Math.floor(state.viewY / grid) * grid;
    const endY = Math.max(startY, state.viewY + state.visibleWorldHeight + grid);

    ctx.save();
    ctx.fillStyle = '#f5f1e8';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#d6c9b6';
    ctx.lineWidth = 1;
    for (let x = startX; x <= endX; x += grid) {
      const px = worldXToCanvas(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += grid) {
      const py = worldYToCanvas(y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    ctx.strokeStyle = '#7b6d5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    ctx.restore();
  }

  function drawStick(object, selected) {
    const x = worldXToCanvas(object.x);
    const y = worldYToCanvas(object.y);
    const width = object.width * state.scale;
    const height = object.height * state.scale;
    const radius = Math.max(1, height * 0.5);

    ctx.save();
    ctx.fillStyle = selected ? '#f7f0de' : '#111111';
    roundRect(x, y, width, height, radius);
    ctx.fill();

    ctx.fillStyle = selected ? 'rgba(138, 209, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)';
    roundRect(x + 4, y + 4, Math.max(1, width - 8), Math.max(1, height * 0.28), Math.max(1, radius - 2));
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = 'rgba(138, 209, 255, 0.95)';
      ctx.lineWidth = 2;
      roundRect(x - 2, y - 2, width + 4, height + 4, radius + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStar(object, selected) {
    const x = worldXToCanvas(object.x);
    const y = worldYToCanvas(object.y);
    const width = object.width * state.scale;
    const height = object.height * state.scale;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const radius = Math.min(width, height) / 2;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    drawStarPath(ctx, radius * 0.95, radius * 0.46, 5, -Math.PI / 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();
    ctx.lineWidth = Math.max(2, radius * 0.2);
    ctx.strokeStyle = '#5d4300';
    ctx.stroke();

    ctx.beginPath();
    drawStarPath(ctx, radius * 0.58, radius * 0.24, 5, -Math.PI / 2);
    ctx.fillStyle = 'rgba(255, 246, 166, 0.95)';
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = 'rgba(138, 209, 255, 0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-radius - 4, -radius - 4, radius * 2 + 8, radius * 2 + 8);
    }

    ctx.restore();
  }

  function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawStarPath(context, outerRadius, innerRadius, points = 5, rotation = -Math.PI / 2) {
    const step = Math.PI / points;
    for (let i = 0; i < points * 2; i++) {
      const angle = rotation + step * i;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    }
    context.closePath();
  }

  function drawWindmill(object, selected) {
    const x = worldXToCanvas(object.x);
    const y = worldYToCanvas(object.y);
    const width = object.width * state.scale;
    const height = object.height * state.scale;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const size = Math.max(width, height);
    const scale = size / 280;
    const bladeLength = 92 * 1.5 * scale;
    const bladeWidth = Math.max(8, 12 * scale);
    const hubRadius = Math.max(8, 10 * scale);
    const outlineRadius = bladeWidth / 2;

    ctx.save();
    ctx.translate(cx, cy);

    for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = '#111111';
      roundRect(-bladeWidth / 2, -bladeLength, bladeWidth, bladeLength, outlineRadius);
      ctx.fill();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, hubRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#111111';
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = 'rgba(138, 209, 255, 0.95)';
      ctx.lineWidth = 2;
      const radius = bladeLength + bladeWidth;
      ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    }

    ctx.restore();
  }

  function drawMovingStick(object, selected) {
    const x = worldXToCanvas(object.x);
    const y = worldYToCanvas(object.y);
    const width = object.width * state.scale;
    const height = object.height * state.scale;
    const radius = Math.max(1, height * 0.5);

    ctx.save();
    ctx.fillStyle = selected ? '#f7f0de' : '#0f0f0f';
    roundRect(x, y, width, height, radius);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    roundRect(x + 4, y + 4, Math.max(1, width - 8), Math.max(1, height * 0.28), Math.max(1, radius - 2));
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + height / 2);
    ctx.lineTo(x + width - 16, y + height / 2);
    ctx.stroke();

    if (selected) {
      ctx.strokeStyle = 'rgba(138, 209, 255, 0.95)';
      ctx.lineWidth = 2;
      roundRect(x - 2, y - 2, width + 4, height + 4, radius + 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderCanvas() {
    resizeCanvas();
    const stageHeight = getStageHeight();
    const mapWidth = state.stageData.settings.mapWidth;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(stageHeight);

    ctx.save();
    const groundY = worldYToCanvas(state.stageData.settings.groundY);
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, groundY - 3, width, 6);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
    ctx.restore();

    state.stageData.objects.forEach((object) => {
      const selected = object.id === state.selectedId;
      if (object.type === 'star') {
        drawStar(object, selected);
      } else if (object.type === 'windmill') {
        drawWindmill(object, selected);
      } else if (object.type === 'moving-stick') {
        drawMovingStick(object, selected);
      } else {
        drawStick(object, selected);
      }
    });

    ctx.save();
    ctx.fillStyle = 'rgba(21, 21, 21, 0.72)';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`mapWidth: ${mapWidth}`, 16, 20);
    ctx.fillText(`groundY: ${state.stageData.settings.groundY}`, 16, 36);
    ctx.fillText(`objects: ${state.stageData.objects.length}`, 16, 52);
    ctx.restore();
  }

  function handleCanvasWheel(event) {
    event.preventDefault();

    const deltaModeFactor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const deltaX = event.deltaX * deltaModeFactor;
    const deltaY = event.deltaY * deltaModeFactor;
    const nextViewX = state.viewX + deltaX / state.scale;
    const nextViewY = state.viewY + deltaY / state.scale;
    const maxViewX = Math.max(0, state.stageData.settings.mapWidth - state.visibleWorldWidth);
    const maxViewY = Math.max(0, getStageHeight() - state.visibleWorldHeight);

    state.viewX = clamp(nextViewX, 0, maxViewX);
    state.viewY = clamp(nextViewY, 0, maxViewY);
    renderCanvas();
  }

  function handleInspectorWheel(event) {
    if (!panelRight) return;

    const target = event.target;
    if (target instanceof HTMLTextAreaElement && canScrollVertically(target, event.deltaY)) {
      return;
    }

    if (!canScrollVertically(panelRight, event.deltaY)) {
      return;
    }

    event.preventDefault();
    panelRight.scrollTop += event.deltaY;
  }

  function selectObject(objectId) {
    state.selectedId = objectId;
    syncSelectedInputs();
    renderObjectList();
    renderCanvas();
  }

  function addObject(type) {
    const defaults = getTypeDefaults(type);
    const x = Math.max(0, Math.round(state.stageData.settings.mapWidth / 2 - defaults.width / 2));
    let y = Math.max(0, Math.round(state.stageData.settings.groundY - 300));
    if (defaults.type === 'star') {
      y = Math.max(0, Math.round(state.stageData.settings.groundY - 400));
    } else if (defaults.type === 'windmill') {
      y = Math.max(0, Math.round(state.stageData.settings.groundY - 700));
    } else if (defaults.type === 'moving-stick') {
      y = Math.max(0, Math.round(state.stageData.settings.groundY - 340));
    }

    const object = normalizeObject({
      id: createId(type),
      type: defaults.type,
      x,
      y,
      width: defaults.width,
      height: defaults.height,
    });

    state.stageData.objects.push(object);
    state.selectedId = object.id;
    syncSelectedInputs();
    render();
    markDirty(`${type} added`);
  }

  function duplicateSelectedObject() {
    const source = getSelectedObject();
    if (!source) return;

    const cloneObject = normalizeObject({
      ...clone(source),
      id: createId(source.type),
      x: source.x + 24,
      y: source.y + 24,
    });

    state.stageData.objects.push(cloneObject);
    state.selectedId = cloneObject.id;
    render();
    markDirty('Object duplicated');
  }

  function deleteSelectedObject() {
    const index = state.stageData.objects.findIndex((object) => object.id === state.selectedId);
    if (index === -1) return;

    state.stageData.objects.splice(index, 1);
    state.selectedId = state.stageData.objects[index - 1]?.id ?? state.stageData.objects[index]?.id ?? null;
    render();
    markDirty('Object deleted');
  }

  function moveSelectedObject(dx, dy) {
    const object = getSelectedObject();
    if (!object) return;

    object.x = Math.round(Math.max(0, object.x + dx));
    object.y = Math.round(Math.max(0, object.y + dy));
    render();
    markDirty('오브젝트를 이동했습니다.');
  }

  function updateSelectedField(field, rawValue) {
    const object = getSelectedObject();
    if (!object) return;

    if (field === 'type') {
      const defaults = getTypeDefaults(rawValue);
      object.type = defaults.type;
      object.width = defaults.width;
      object.height = defaults.height;
      delete object.speed;
      delete object.direction;
      delete object.rotationSpeed;
      if (object.type === 'moving-stick') {
        object.speed = DEFAULT_MOVING_STICK_SPEED;
        object.direction = DEFAULT_MOVING_STICK_DIRECTION;
      }
    } else if (field === 'speed') {
      const speedValue = Math.abs(Number(rawValue));
      object.speed = Number.isFinite(speedValue) && speedValue > 0 ? Math.max(0.1, speedValue) : object.speed || DEFAULT_MOVING_STICK_SPEED;
    } else if (field === 'direction') {
      object.direction = normalizeDirection(rawValue, object.direction);
    } else {
      const value = Math.round(numberOr(rawValue, object[field]));
      if (field === 'width' || field === 'height') {
        object[field] = Math.max(1, value);
      } else {
        object[field] = value;
      }
    }

    render();
    markDirty('오브젝트를 수정했습니다.');
  }

  function updateMetaField(field, rawValue) {
    if (field === 'name') {
      state.stageData.name = String(rawValue || '새 스테이지');
    } else if (field === 'stage') {
      state.stageData.stage = Math.max(1, Math.floor(numberOr(rawValue, 1)));
      if (!state.stageData.name || state.stageData.name === '새 스테이지') {
        state.stageData.name = `스테이지 ${state.stageData.stage}`;
      }
    } else if (field === 'mapWidth') {
      state.stageData.settings.mapWidth = Math.max(200, Math.round(numberOr(rawValue, DEFAULT_MAP_WIDTH)));
    } else if (field === 'groundY') {
      state.stageData.settings.groundY = Math.max(0, Math.round(numberOr(rawValue, DEFAULT_GROUND_Y)));
    }

    render();
    markDirty('스테이지 정보가 수정되었습니다.');
  }

  function applyJsonText() {
    try {
      const parsed = JSON.parse(refs.jsonOutput.value);
      state.stageData = normalizeStageData(parsed);
      state.selectedId = state.stageData.objects[0]?.id ?? null;
      render();
      syncJsonOutput(true);
      markDirty('JSON을 적용했습니다.');
      setStatus('JSON을 적용했습니다.');
    } catch (error) {
      setStatus(`JSON 오류: ${error.message}`);
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(formatJson());
      setStatus('JSON을 클립보드에 복사했습니다.');
    } catch {
      setStatus('클립보드 복사에 실패했습니다.');
    }
  }

  function downloadJson() {
    const blob = new Blob([formatJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `stage-${String(state.stageData.stage).padStart(2, '0')}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus('JSON 다운로드를 시작했습니다.');
  }

  function loadSample() {
    state.stageData = normalizeStageData(createSampleStage());
    state.selectedId = state.stageData.objects[0]?.id ?? null;
    render();
    syncJsonOutput(true);
    markDirty('샘플을 불러왔습니다.');
  }

  function resetStage() {
    state.stageData = normalizeStageData(createBlankStage());
    state.selectedId = null;
    render();
    syncJsonOutput(true);
    markDirty('빈 스테이지를 만들었습니다.');
  }

  function saveLocal() {
    if (persistDraft()) {
      setStatus('초안을 로컬에 저장했습니다.');
    } else {
      setStatus('저장에 실패했습니다.');
    }
  }

  function importFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        state.stageData = normalizeStageData(parsed);
        state.selectedId = state.stageData.objects[0]?.id ?? null;
        render();
        syncJsonOutput(true);
        markDirty('파일을 불러왔습니다.');
        setStatus(`파일을 불러왔습니다: ${file.name}`);
      } catch (error) {
        setStatus(`가져오기에 실패했습니다: ${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  function hitTest(worldX, worldY) {
    for (let i = state.stageData.objects.length - 1; i >= 0; i -= 1) {
      const object = state.stageData.objects[i];
      if (
        worldX >= object.x &&
        worldX <= object.x + object.width &&
        worldY >= object.y &&
        worldY <= object.y + object.height
      ) {
        return object;
      }
    }
    return null;
  }

  function getWorldPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: state.viewX + (event.clientX - rect.left) / state.scale,
      y: state.viewY + (event.clientY - rect.top) / state.scale,
    };
  }

  function handlePointerDown(event) {
    if (event.button === 2) {
      state.panning = {
        startX: event.clientX,
        startY: event.clientY,
        startViewX: state.viewX,
        startViewY: state.viewY,
      };
      canvasScroll.classList.add('is-panning');
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    const point = getWorldPoint(event);
    const object = hitTest(point.x, point.y);
    if (!object) {
      selectObject(null);
      return;
    }

    selectObject(object.id);
    state.dragging = {
      id: object.id,
      offsetX: point.x - object.x,
      offsetY: point.y - object.y,
    };

    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (state.panning) {
      const deltaX = event.clientX - state.panning.startX;
      const deltaY = event.clientY - state.panning.startY;
      const maxViewX = Math.max(0, state.stageData.settings.mapWidth - state.visibleWorldWidth);
      const maxViewY = Math.max(0, getStageHeight() - state.visibleWorldHeight);
      state.viewX = clamp(state.panning.startViewX - deltaX / state.scale, 0, maxViewX);
      state.viewY = clamp(state.panning.startViewY - deltaY / state.scale, 0, maxViewY);
      event.preventDefault();
      renderCanvas();
      return;
    }

    if (!state.dragging) return;
    const object = getSelectedObject();
    if (!object) return;

    const point = getWorldPoint(event);
    const maxX = Math.max(0, state.stageData.settings.mapWidth - object.width);
    object.x = Math.round(clamp(point.x - state.dragging.offsetX, 0, maxX));
    object.y = Math.round(Math.max(0, point.y - state.dragging.offsetY));
    render();
    schedulePersist();
  }

  function handlePointerUp(event) {
    if (state.panning) {
      state.panning = null;
      canvasScroll.classList.remove('is-panning');
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore capture release failures.
      }
      return;
    }

    if (!state.dragging) return;
    state.dragging = null;
    markDirty('오브젝트를 이동했습니다.');
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore capture release failures.
    }
  }

  function render() {
    syncMetaInputs();
    syncSelectedInputs();
    syncJsonOutput();
    renderObjectList();
    renderCanvas();
  }

  function addEventHandlers() {
    refs.stageName.addEventListener('input', (event) => updateMetaField('name', event.target.value));
    refs.stageNumber.addEventListener('input', (event) => updateMetaField('stage', event.target.value));
    refs.mapWidth.addEventListener('input', (event) => updateMetaField('mapWidth', event.target.value));
    refs.groundY.addEventListener('input', (event) => updateMetaField('groundY', event.target.value));

    refs.objectList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-object-id]');
      if (!button) return;
      selectObject(button.dataset.objectId);
    });

    refs.objectType.addEventListener('change', (event) => updateSelectedField('type', event.target.value));
    refs.objectX.addEventListener('input', (event) => updateSelectedField('x', event.target.value));
    refs.objectY.addEventListener('input', (event) => updateSelectedField('y', event.target.value));
    refs.objectWidth.addEventListener('input', (event) => updateSelectedField('width', event.target.value));
    refs.objectHeight.addEventListener('input', (event) => updateSelectedField('height', event.target.value));
    refs.objectSpeed.addEventListener('input', (event) => updateSelectedField('speed', event.target.value));
    refs.objectDirection.addEventListener('change', (event) => updateSelectedField('direction', event.target.value));

    refs.addStickBtn.addEventListener('click', () => addObject('stick'));
    refs.addStarBtn.addEventListener('click', () => addObject('star'));
    refs.addMovingStickBtn.addEventListener('click', () => addObject('moving-stick'));
    refs.addWindmillBtn.addEventListener('click', () => addObject('windmill'));
    refs.duplicateBtn.addEventListener('click', duplicateSelectedObject);
    refs.deleteBtn.addEventListener('click', deleteSelectedObject);
    refs.exportJsonBtn.addEventListener('click', () => syncJsonOutput(true));
    refs.downloadBtn.addEventListener('click', downloadJson);
    refs.copyBtn.addEventListener('click', copyJson);
    refs.applyJsonBtn.addEventListener('click', applyJsonText);
    refs.loadSampleBtn.addEventListener('click', loadSample);
    refs.resetBtn.addEventListener('click', resetStage);
    refs.saveLocalBtn.addEventListener('click', saveLocal);
    refs.importFile.addEventListener('change', (event) => {
      importFile(event.target.files?.[0] || null);
      event.target.value = '';
    });

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvasScroll.addEventListener('wheel', handleCanvasWheel, { passive: false });
    if (panelRight) {
      panelRight.addEventListener('wheel', handleInspectorWheel, { passive: false });
    }
    window.addEventListener('resize', renderCanvas);
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return;
      }

      if (!state.selectedId) return;

      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelectedObject(-step, 0);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelectedObject(step, 0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelectedObject(0, -step);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelectedObject(0, step);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedObject();
      } else if (event.key.toLowerCase() === 'd' && event.metaKey === false && event.ctrlKey) {
        event.preventDefault();
        duplicateSelectedObject();
      }
    });
  }

  function init() {
    if (!loadDraft()) {
      state.stageData = normalizeStageData(createSampleStage());
      state.selectedId = state.stageData.objects[0]?.id ?? null;
    }
    addEventHandlers();
    render();
    setStatus('에디터 준비 완료');
  }

  init();
})();
