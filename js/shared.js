(() => {
  const SAVE_KEY = 'upupup.io.save.v1';
  const PREFS_KEY = 'upupup.io.prefs.v1';
  const SAVE_SECRET = 'upupup.io::save::v1::9f3c';
  const SAVE_VERSION = 1;
  const AUTOSAVE_INTERVAL_MS = 12000;
  const START_MODE_KEY = 'upupup.io.startMode.v1';
  const SAVE_TOMBSTONE_KEY = 'upupup.io.saveDeleted.v1';
  const CREDIT_BALANCE_KEY = 'upupup.io.creditBalance.v1';
  const INFINITE_BEST_SCORE_KEY = 'upupup.io.infiniteBestScore.v1';
  const INFINITE_BEST_RECORD_KEY = 'upupup.io.infiniteBestRecord.v1';
  const LEADERBOARD_KEY = 'upupup.io.leaderboard.v1';
  const STAGE_PROGRESS_KEY = 'upupup.io.stageProgress.v1';
  const STAGE_EDITOR_DRAFT_KEY = 'upupup.stage-editor.draft.v1';
  const STAGE_EDITOR_STAGE_PREFIX = 'upupup.stage-editor.stage.v1.';

  const SECURE_DB_NAME = 'upupup.io.secure.v1';
  const SECURE_DB_VERSION = 1;
  const SECURE_STORE_NAME = 'vault';
  const SECURE_KEY_RECORD = 'save-key';
  const SECURE_SAVE_RECORD = 'save-state';
  const SECURE_INFINITE_BEST_RECORD = 'infinite-best-record';
  const SECURE_STAGE_PROGRESS_RECORD = 'stage-progress';
  const LEADERBOARD_MAX_ENTRIES = 10;

  let secureDb = null;
  let secureDbPromise = null;
  let secureKey = null;
  let secureKeyPromise = null;
  let secureStorageReady = false;
  let secureStorageSupported = false;
  let cachedSave = null;
  let cachedInfiniteBestRecord = { score: 0, elapsedMs: null, savedAt: 0 };
  let cachedStageProgress = { maxUnlockedStage: 1 };

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
      return data && typeof data === 'object' ? data : null;
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
      gridVisible: prefs?.gridVisible !== false,
      audioVolume: Number.isFinite(prefs?.audioVolume)
        ? Math.max(0, Math.min(1, prefs.audioVolume))
        : 0.8,
    };
  }

  function writePrefs(prefs) {
    try {
      const current = readPrefs();
      writeJSONStorage(PREFS_KEY, {
        autoSaveEnabled:
          typeof prefs.autoSaveEnabled === 'boolean' ? prefs.autoSaveEnabled : current.autoSaveEnabled,
        gridVisible: typeof prefs.gridVisible === 'boolean' ? prefs.gridVisible : current.gridVisible,
        audioVolume: Number.isFinite(prefs.audioVolume)
          ? Math.max(0, Math.min(1, prefs.audioVolume))
          : current.audioVolume,
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

  function formatDuration(durationMs) {
    if (!Number.isFinite(durationMs)) {
      return '--:--';
    }

    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function normalizeScore(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function normalizeCreditBalance(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function normalizeElapsedMs(value) {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.floor(value));
  }

  function normalizeInfiniteBestRecord(raw) {
    if (raw == null) {
      return { score: 0, elapsedMs: null, savedAt: 0 };
    }

    if (Number.isFinite(raw)) {
      return {
        score: normalizeScore(raw),
        elapsedMs: null,
        savedAt: 0,
      };
    }

    if (typeof raw !== 'object') {
      return { score: 0, elapsedMs: null, savedAt: 0 };
    }

    return {
      score: normalizeScore(raw.score),
      elapsedMs: normalizeElapsedMs(raw.elapsedMs),
      savedAt: Number.isFinite(raw.savedAt) ? Math.max(0, Math.floor(raw.savedAt)) : 0,
    };
  }

  function normalizeLeaderboardNickname(value) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 16);
  }

  function normalizeLeaderboardEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const nickname = normalizeLeaderboardNickname(raw.nickname);
    const passwordHash = String(raw.passwordHash ?? '');
    if (!nickname || !passwordHash) return null;

    return {
      nickname,
      passwordHash,
      score: normalizeScore(raw.score),
      elapsedMs: normalizeElapsedMs(raw.elapsedMs),
      savedAt: Number.isFinite(raw.savedAt) ? Math.max(0, Math.floor(raw.savedAt)) : 0,
    };
  }

  function isLeaderboardEntryBetter(candidate, current) {
    if (!current) return true;
    if (candidate.score !== current.score) {
      return candidate.score > current.score;
    }

    const candidateElapsed = Number.isFinite(candidate.elapsedMs) ? candidate.elapsedMs : Number.POSITIVE_INFINITY;
    const currentElapsed = Number.isFinite(current.elapsedMs) ? current.elapsedMs : Number.POSITIVE_INFINITY;
    if (candidateElapsed !== currentElapsed) {
      return candidateElapsed < currentElapsed;
    }

    return candidate.savedAt > current.savedAt;
  }

  function compareLeaderboardEntries(a, b) {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    const aElapsed = Number.isFinite(a.elapsedMs) ? a.elapsedMs : Number.POSITIVE_INFINITY;
    const bElapsed = Number.isFinite(b.elapsedMs) ? b.elapsedMs : Number.POSITIVE_INFINITY;
    if (aElapsed !== bElapsed) {
      return aElapsed - bElapsed;
    }

    return b.savedAt - a.savedAt;
  }

  function readLeaderboardEntries() {
    const raw = readJSONStorage(LEADERBOARD_KEY);
    const entries = Array.isArray(raw)
      ? raw.map(normalizeLeaderboardEntry).filter(Boolean)
      : [];
    return entries.sort(compareLeaderboardEntries).slice(0, LEADERBOARD_MAX_ENTRIES);
  }

  function writeLeaderboardEntries(entries) {
    try {
      const normalized = Array.isArray(entries)
        ? entries.map(normalizeLeaderboardEntry).filter(Boolean).sort(compareLeaderboardEntries).slice(0, LEADERBOARD_MAX_ENTRIES)
        : [];
      writeJSONStorage(LEADERBOARD_KEY, normalized);
    } catch {
      return false;
    }
    return true;
  }

  function submitLeaderboardEntry({
    nickname,
    password,
    score,
    elapsedMs = null,
    savedAt = Date.now(),
  } = {}) {
    const cleanNickname = normalizeLeaderboardNickname(nickname);
    const cleanPassword = String(password ?? '').trim();
    const normalizedScore = normalizeScore(score);

    if (!cleanNickname || !cleanPassword) {
      return { ok: false, error: '닉네임과 비밀번호를 입력하세요.' };
    }
    if (normalizedScore <= 0) {
      return { ok: false, error: '등록할 점수가 없습니다.' };
    }

    const candidate = {
      nickname: cleanNickname,
      passwordHash: String(fnv1a(cleanPassword)),
      score: normalizedScore,
      elapsedMs: normalizeElapsedMs(elapsedMs),
      savedAt: Number.isFinite(savedAt) ? Math.max(0, Math.floor(savedAt)) : Date.now(),
    };

    const entries = readLeaderboardEntries();
    const existingIndex = entries.findIndex((entry) => entry.nickname === cleanNickname);
    let nextEntry = candidate;

    if (existingIndex >= 0) {
      const current = entries[existingIndex];
      if (current.passwordHash !== candidate.passwordHash) {
        return { ok: false, error: '비밀번호가 맞지 않습니다.' };
      }

      if (isLeaderboardEntryBetter(candidate, current)) {
        nextEntry = { ...current, ...candidate };
        entries[existingIndex] = nextEntry;
      } else {
        nextEntry = current;
      }
    } else {
      entries.push(candidate);
    }

    if (!writeLeaderboardEntries(entries)) {
      return { ok: false, error: '순위표 저장에 실패했습니다.' };
    }

    return {
      ok: true,
      entry: nextEntry,
      updated: existingIndex >= 0,
    };
  }

  function writeStartMode(mode) {
    try {
      sessionStorage.setItem(START_MODE_KEY, mode);
    } catch {
      return false;
    }
    return true;
  }

  function readCreditBalance() {
    return normalizeCreditBalance(readJSONStorage(CREDIT_BALANCE_KEY));
  }

  function writeCreditBalance(balance) {
    try {
      writeJSONStorage(CREDIT_BALANCE_KEY, normalizeCreditBalance(balance));
    } catch {
      return false;
    }
    return true;
  }

  function normalizeStageNumber(stageNumber) {
    const value = Number(stageNumber);
    return Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
  }

  function normalizeIdList(value) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const item of value) {
      const id = String(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      output.push(id);
    }
    return output;
  }

  function normalizeMapState(mapState, seedFallback = 0) {
    const source = mapState && typeof mapState === 'object' ? mapState : {};
    const nextSpawnY = Number.isFinite(source.nextSpawnY) ? Math.max(0, Math.floor(source.nextSpawnY)) : null;
    const pathX = Number.isFinite(source.pathX) ? Math.max(0, Math.floor(source.pathX)) : null;
    const seed = Number.isFinite(source.seed) ? source.seed >>> 0 : seedFallback >>> 0;
    return {
      seed,
      nextSpawnY,
      pathX,
      collectedCreditIds: normalizeIdList(source.collectedCreditIds),
      collectedStarIds: normalizeIdList(source.collectedStarIds),
      collectedPortalIds: normalizeIdList(source.collectedPortalIds),
    };
  }

  function normalizeSaveData(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const mode = raw.mode === 'stage' ? 'stage' : 'infinite';
    const stage = normalizeStageNumber(raw.stage);
    const seed = Number.isFinite(raw.seed) ? raw.seed >>> 0 : createSeed();
    const player = raw.player && typeof raw.player === 'object' ? raw.player : {};
    const map = normalizeMapState(raw.map, seed);

    return {
      version: SAVE_VERSION,
      savedAt: Number.isFinite(raw.savedAt) ? Math.max(0, Math.floor(raw.savedAt)) : Date.now(),
      mode,
      stage,
      seed,
      player: {
        x: Number.isFinite(player.x) ? Number(player.x) : 0,
        y: Number.isFinite(player.y) ? Number(player.y) : 0,
        vx: Number.isFinite(player.vx) ? Number(player.vx) : 0,
        vy: Number.isFinite(player.vy) ? Number(player.vy) : 0,
        onGround: Boolean(player.onGround),
      },
      map,
      score: Math.max(0, Math.floor(Number(raw.score) || 0)),
      credits: Math.max(0, Math.floor(Number(raw.credits) || 0)),
      run: {
        elapsedMs: normalizeElapsedMs(raw.run?.elapsedMs) ?? 0,
      },
    };
  }

  function normalizeStageProgressData(raw) {
    return {
      maxUnlockedStage: Math.max(1, Math.floor(Number(raw?.maxUnlockedStage) || 1)),
    };
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value;
    }
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
    return value;
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  function openSecureDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB || !window.crypto?.subtle) {
        reject(new Error('Secure storage unavailable'));
        return;
      }

      const request = indexedDB.open(SECURE_DB_NAME, SECURE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SECURE_STORE_NAME)) {
          db.createObjectStore(SECURE_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
  }

  async function getSecureDb() {
    if (secureDb) return secureDb;
    if (!secureDbPromise) {
      secureDbPromise = openSecureDb().then((db) => {
        secureDb = db;
        return db;
      });
    }
    secureDb = await secureDbPromise;
    return secureDb;
  }

  async function getSecureKey() {
    if (secureKey) return secureKey;
    if (secureKeyPromise) {
      secureKey = await secureKeyPromise;
      return secureKey;
    }

    secureKeyPromise = (async () => {
      const db = await getSecureDb();
      const tx = db.transaction(SECURE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SECURE_STORE_NAME);
      const existing = await requestToPromise(store.get(SECURE_KEY_RECORD));

      if (existing?.key) {
        await txDone(tx);
        return existing.key;
      }

      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      await requestToPromise(store.put({ key }, SECURE_KEY_RECORD));
      await txDone(tx);
      return key;
    })();

    secureKey = await secureKeyPromise;
    return secureKey;
  }

  function uint8ToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  function base64ToUint8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function encryptRecord(recordName, data) {
    const key = await getSecureKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const payload = encoder.encode(JSON.stringify(data));
    const additionalData = encoder.encode(`${SECURE_DB_NAME}:${recordName}:v1`);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData },
      key,
      payload
    );

    return {
      version: 1,
      iv: uint8ToBase64(iv),
      ciphertext: uint8ToBase64(new Uint8Array(encrypted)),
    };
  }

  async function decryptRecord(recordName, record) {
    if (!record || record.version !== 1) return null;
    if (typeof record.iv !== 'string' || typeof record.ciphertext !== 'string') return null;

    const key = await getSecureKey();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const iv = base64ToUint8(record.iv);
    const ciphertext = base64ToUint8(record.ciphertext);
    const additionalData = encoder.encode(`${SECURE_DB_NAME}:${recordName}:v1`);

    try {
      const plaintext = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData },
        key,
        ciphertext
      );
      return JSON.parse(decoder.decode(plaintext));
    } catch {
      return null;
    }
  }

  async function readSecureRecord(recordName) {
    const db = await getSecureDb();
    const tx = db.transaction(SECURE_STORE_NAME, 'readonly');
    const store = tx.objectStore(SECURE_STORE_NAME);
    const record = await requestToPromise(store.get(recordName));
    await txDone(tx);
    return record ?? null;
  }

  async function writeSecureRecord(recordName, record) {
    const db = await getSecureDb();
    const tx = db.transaction(SECURE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SECURE_STORE_NAME);
    await requestToPromise(store.put(record, recordName));
    await txDone(tx);
    return true;
  }

  function readLegacySave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return decodeSave(raw);
    } catch {
      return null;
    }
  }

  function writeLegacySave(data) {
    localStorage.setItem(SAVE_KEY, encodeSave(data));
  }

  function readLegacyInfiniteBestRecord() {
    try {
      const rawRecord = readJSONStorage(INFINITE_BEST_RECORD_KEY);
      if (rawRecord != null) {
        return normalizeInfiniteBestRecord(rawRecord);
      }
      return normalizeInfiniteBestRecord(readJSONStorage(INFINITE_BEST_SCORE_KEY));
    } catch {
      return { score: 0, elapsedMs: null, savedAt: 0 };
    }
  }

  function readLegacyStageProgress() {
    const progress = readJSONStorage(STAGE_PROGRESS_KEY);
    return normalizeStageProgressData(progress);
  }

  function writeLegacyStageProgress(progress) {
    try {
      const current = readLegacyStageProgress();
      writeJSONStorage(STAGE_PROGRESS_KEY, {
        maxUnlockedStage: Math.max(
          1,
          Math.floor(Number.isFinite(progress?.maxUnlockedStage)
            ? progress.maxUnlockedStage
            : current.maxUnlockedStage)
        ),
      });
    } catch {
      return false;
    }
    return true;
  }

  async function loadSecureCache() {
    secureStorageSupported = Boolean(window.indexedDB && window.crypto?.subtle);
    if (!secureStorageSupported) {
      cachedSave = deepFreeze(normalizeSaveData(readLegacySave()));
      cachedInfiniteBestRecord = deepFreeze(normalizeInfiniteBestRecord(readLegacyInfiniteBestRecord()));
      cachedStageProgress = deepFreeze(normalizeStageProgressData(readLegacyStageProgress()));
      secureStorageReady = true;
      return;
    }

    try {
      await getSecureKey();
      const [saveRecord, bestRecord, progressRecord] = await Promise.all([
        readSecureRecord(SECURE_SAVE_RECORD),
        readSecureRecord(SECURE_INFINITE_BEST_RECORD),
        readSecureRecord(SECURE_STAGE_PROGRESS_RECORD),
      ]);

      const decodedSave = await decryptRecord(SECURE_SAVE_RECORD, saveRecord);
      const decodedBestRecord = await decryptRecord(SECURE_INFINITE_BEST_RECORD, bestRecord);
      const decodedProgress = await decryptRecord(SECURE_STAGE_PROGRESS_RECORD, progressRecord);
      const legacySave = normalizeSaveData(readLegacySave());
      const legacyBestRecord = normalizeInfiniteBestRecord(readLegacyInfiniteBestRecord());
      const legacyProgress = normalizeStageProgressData(readLegacyStageProgress());
      cachedSave = readJSONStorage(SAVE_TOMBSTONE_KEY)
        ? null
        : deepFreeze(normalizeSaveData(decodedSave) ?? legacySave);
      cachedInfiniteBestRecord = deepFreeze(decodedBestRecord ? normalizeInfiniteBestRecord(decodedBestRecord) : legacyBestRecord);
      cachedStageProgress = deepFreeze(normalizeStageProgressData(decodedProgress) ?? legacyProgress);

      if (!saveRecord) {
        if (legacySave) {
          cachedSave = deepFreeze(legacySave);
          const record = await encryptRecord(SECURE_SAVE_RECORD, legacySave);
          await writeSecureRecord(SECURE_SAVE_RECORD, record);
        }
      }

      if (!bestRecord) {
        cachedInfiniteBestRecord = deepFreeze(legacyBestRecord);
        const record = await encryptRecord(SECURE_INFINITE_BEST_RECORD, legacyBestRecord);
        await writeSecureRecord(SECURE_INFINITE_BEST_RECORD, record);
      }

      if (!progressRecord) {
        cachedStageProgress = deepFreeze(legacyProgress);
        const record = await encryptRecord(SECURE_STAGE_PROGRESS_RECORD, legacyProgress);
        await writeSecureRecord(SECURE_STAGE_PROGRESS_RECORD, record);
      }
    } catch {
      secureStorageSupported = false;
      secureDb = null;
      secureDbPromise = null;
      secureKey = null;
      secureKeyPromise = null;
      cachedSave = deepFreeze(normalizeSaveData(readLegacySave()));
      cachedInfiniteBestRecord = deepFreeze(normalizeInfiniteBestRecord(readLegacyInfiniteBestRecord()));
      cachedStageProgress = deepFreeze(normalizeStageProgressData(readLegacyStageProgress()));
    } finally {
      secureStorageReady = true;
    }
  }

  const ready = loadSecureCache();

  function storageReadSave() {
    if (readJSONStorage(SAVE_TOMBSTONE_KEY)) {
      return null;
    }
    if (secureStorageReady && cachedSave) {
      return cachedSave;
    }
    return normalizeSaveData(readLegacySave());
  }

  async function storageWriteSave(data) {
    const normalized = normalizeSaveData(data);
    if (!normalized) return false;

    if (secureStorageSupported) {
      try {
        const record = await encryptRecord(SECURE_SAVE_RECORD, normalized);
        await writeSecureRecord(SECURE_SAVE_RECORD, record);
      } catch {
        // Fall back to the localStorage backup below.
      }
    }

    try {
      writeLegacySave(normalized);
      cachedSave = deepFreeze(normalized);
      writeJSONStorage(SAVE_TOMBSTONE_KEY, false);
      return true;
    } catch {
      if (secureStorageSupported) {
        try {
          cachedSave = deepFreeze(normalized);
          writeJSONStorage(SAVE_TOMBSTONE_KEY, false);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  function readStageProgress() {
    if (secureStorageReady && cachedStageProgress) {
      return cachedStageProgress;
    }
    return normalizeStageProgressData(readLegacyStageProgress());
  }

  async function writeStageProgress(progress) {
    const normalized = normalizeStageProgressData(progress);
    if (secureStorageSupported) {
      try {
        const record = await encryptRecord(SECURE_STAGE_PROGRESS_RECORD, normalized);
        await writeSecureRecord(SECURE_STAGE_PROGRESS_RECORD, record);
      } catch {
        // Fall back to the localStorage backup below.
      }
    }

    try {
      writeLegacyStageProgress(normalized);
      cachedStageProgress = deepFreeze(normalized);
      return true;
    } catch {
      if (secureStorageSupported) {
        try {
          cachedStageProgress = deepFreeze(normalized);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async function unlockStage(stageNumber) {
    const current = readStageProgress();
    const nextUnlocked = Math.max(current.maxUnlockedStage, normalizeStageNumber(stageNumber) + 1);
    return writeStageProgress({ maxUnlockedStage: nextUnlocked });
  }

  function getUnlockedStageLimit() {
    return readStageProgress().maxUnlockedStage;
  }

  function readInfiniteBestRecord() {
    if (secureStorageReady && cachedInfiniteBestRecord) {
      return cachedInfiniteBestRecord;
    }
    return normalizeInfiniteBestRecord(readLegacyInfiniteBestRecord());
  }

  async function writeInfiniteBestRecord(record) {
    const normalized = normalizeInfiniteBestRecord(record);
    if (secureStorageSupported) {
      try {
        const encrypted = await encryptRecord(SECURE_INFINITE_BEST_RECORD, normalized);
        await writeSecureRecord(SECURE_INFINITE_BEST_RECORD, encrypted);
      } catch {
        // Fall back to the localStorage backup below.
      }
    }

    try {
      writeJSONStorage(INFINITE_BEST_RECORD_KEY, normalized);
      writeJSONStorage(INFINITE_BEST_SCORE_KEY, normalized.score);
      cachedInfiniteBestRecord = deepFreeze(normalized);
      return true;
    } catch {
      if (secureStorageSupported) {
        try {
          cachedInfiniteBestRecord = deepFreeze(normalized);
          writeJSONStorage(INFINITE_BEST_SCORE_KEY, normalized.score);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  function getStageEditorStageKey(stageNumber) {
    return `${STAGE_EDITOR_STAGE_PREFIX}${normalizeStageNumber(stageNumber)}`;
  }

  function readStageEditorDraft() {
    return readJSONStorage(STAGE_EDITOR_DRAFT_KEY);
  }

  function writeStageEditorDraft(data) {
    try {
      writeJSONStorage(STAGE_EDITOR_DRAFT_KEY, data);
    } catch {
      return false;
    }
    return true;
  }

  function storageDeleteSave() {
    try {
      writeLegacySave(null);
      writeJSONStorage(SAVE_TOMBSTONE_KEY, true);
      cachedSave = null;
      return true;
    } catch {
      return false;
    }
  }

  function readInfiniteBestScore() {
    return readInfiniteBestRecord().score;
  }

  function writeInfiniteBestScore(score) {
    return writeInfiniteBestRecord({
      score: normalizeScore(score),
      elapsedMs: readInfiniteBestRecord().elapsedMs,
      savedAt: Date.now(),
    });
  }

  function readStageEditorStage(stageNumber) {
    return readJSONStorage(getStageEditorStageKey(stageNumber));
  }

  function writeStageEditorStage(stageNumber, data) {
    try {
      writeJSONStorage(getStageEditorStageKey(stageNumber), data);
    } catch {
      return false;
    }
    return true;
  }

  function hasStageEditorStage(stageNumber) {
    return Boolean(readStageEditorStage(stageNumber));
  }

  window.UpUpUpShared = {
    SAVE_KEY,
    PREFS_KEY,
    SAVE_SECRET,
    SAVE_VERSION,
    AUTOSAVE_INTERVAL_MS,
    START_MODE_KEY,
    getViewportSize,
    clamp,
    createSeed,
    fnv1a,
    encodeSave,
    decodeSave,
    readJSONStorage,
    writeJSONStorage,
    readPrefs,
    writePrefs,
    formatTime,
    formatDuration,
    numberOr,
    writeStartMode,
    readCreditBalance,
    writeCreditBalance,
    storageReadSave,
    storageWriteSave,
    storageDeleteSave,
    readInfiniteBestRecord,
    readInfiniteBestScore,
    writeInfiniteBestRecord,
    writeInfiniteBestScore,
    LEADERBOARD_MAX_ENTRIES,
    readLeaderboardEntries,
    writeLeaderboardEntries,
    submitLeaderboardEntry,
    STAGE_PROGRESS_KEY,
    STAGE_EDITOR_DRAFT_KEY,
    STAGE_EDITOR_STAGE_PREFIX,
    readStageProgress,
    writeStageProgress,
    unlockStage,
    getUnlockedStageLimit,
    normalizeStageNumber,
    getStageEditorStageKey,
    readStageEditorDraft,
    writeStageEditorDraft,
    readStageEditorStage,
    writeStageEditorStage,
    hasStageEditorStage,
    ready,
  };
})();
