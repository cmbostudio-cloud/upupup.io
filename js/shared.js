(() => {
  const SAVE_KEY = 'upupup.io.save.v1';
  const PREFS_KEY = 'upupup.io.prefs.v1';
  const SAVE_SECRET = 'upupup.io::save::v1::9f3c';
  const SAVE_VERSION = 1;
  const AUTOSAVE_INTERVAL_MS = 12000;
  const START_MODE_KEY = 'upupup.io.startMode.v1';

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

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function readStartMode() {
    try {
      const mode = sessionStorage.getItem(START_MODE_KEY);
      return mode === 'play' || mode === 'continue' ? mode : 'menu';
    } catch {
      return 'menu';
    }
  }

  function writeStartMode(mode) {
    try {
      sessionStorage.setItem(START_MODE_KEY, mode);
    } catch {
      return false;
    }
    return true;
  }

  function clearStartMode() {
    try {
      sessionStorage.removeItem(START_MODE_KEY);
    } catch {
      return false;
    }
    return true;
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
    numberOr,
    readStartMode,
    writeStartMode,
    clearStartMode,
    storageReadSave,
    storageWriteSave,
  };
})();
