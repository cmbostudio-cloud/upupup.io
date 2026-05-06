(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyDo8hYz80qYKTrJBLFyPHRrS_Rvx6XPZWQ',
    authDomain: 'upupupio.firebaseapp.com',
    projectId: 'upupupio',
    storageBucket: 'upupupio.firebasestorage.app',
    messagingSenderId: '412158488389',
    appId: '1:412158488389:web:0d6a548d0bddaaaca6182c',
    measurementId: 'G-RS93066VTN',
  };

  const LEADERBOARD_COLLECTION = 'infiniteLeaderboard';
  const USER_DATA_COLLECTION = 'userData';
  const GUEST_DATA_COLLECTION = 'guestUserData';
  const LEADERBOARD_LIMIT = 20;
  const EDITOR_ACCESS_CLAIMS = ['admin', 'editor', 'stageEditor'];
  const CLOUD_OWNER_KEY = 'upupup.io.cloudOwnerUid.v1';

  let app = null;
  let auth = null;
  let db = null;
  let googleProvider = null;
  let analytics = null;
  let authModal = null;
  let authReadyPromise = null;
  let isGuestSession = false;
  let isLocalGuestSession = false;
  let cloudSyncTimer = null;
  let cloudSyncPromise = Promise.resolve();

  function init() {
    if (app) return;
    if (!window.firebase || !window.firebase.auth) throw new Error('Firebase SDK not loaded');

    app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
    auth = window.firebase.auth();
    db = window.firebase.firestore ? window.firebase.firestore() : null;
    googleProvider = new window.firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    if (window.firebase.analytics) analytics = window.firebase.analytics();
    authReadyPromise = new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged(() => {
        unsub();
        resolve(auth.currentUser);
      });
    });
  }

  async function waitForAuthReady() {
    init();
    await authReadyPromise;
    return auth.currentUser;
  }

  function ensureAuthModal() {
    if (authModal) return authModal;

    const overlay = document.createElement('div');
    overlay.className = 'auth-screen';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title" class="auth-title">Google 계정 저장</h2>
        <p class="auth-desc">Google 계정으로 접속하면 진행, 크레딧, 최고 기록, 스테이지 진행도가 계정에 저장됩니다.</p>
        <button class="auth-line-btn" data-auth-action="google" type="button">Google로 회원가입 및 로그인하기</button>
        <button class="auth-line-btn auth-guest-btn" data-auth-action="guest" type="button">게스트로 플레이하기</button>
        <p class="auth-hint" id="auth-hint" aria-live="polite"></p>
      </div>
    `;

    document.body.appendChild(overlay);
    authModal = overlay;
    return authModal;
  }

  async function ensureSignedIn() {
    init();
    await waitForAuthReady();
    if (auth.currentUser && !auth.currentUser.isAnonymous) return auth.currentUser;
    const result = await auth.signInWithPopup(googleProvider);
    return result.user;
  }


  function isAnonymousAuthUnavailable(error) {
    const code = String(error?.code || error?.message || '');
    return code.includes('operation-not-allowed') || code.includes('admin-restricted-operation');
  }

  function getGuestSetupErrorMessage(error) {
    const code = String(error?.code || error?.message || '');
    if (isAnonymousAuthUnavailable(error)) {
      return 'Firebase 익명 로그인이 꺼져 있어 로컬 게스트 저장으로 시작합니다.';
    }
    if (code.includes('permission-denied')) {
      return '게스트 클라우드 저장 권한이 없습니다. Firestore 규칙에서 guestUserData 읽기/쓰기를 허용해야 합니다.';
    }
    if (code.includes('unauthenticated')) {
      return '게스트 인증 토큰을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.';
    }
    if (code.includes('network-request-failed') || code.includes('unavailable') || code.includes('deadline-exceeded')) {
      return '네트워크 문제로 게스트 클라우드 저장에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
    }
    if (code.includes('cloud-firestore-unavailable')) {
      return 'Firestore SDK를 불러오지 못해 게스트 클라우드 저장을 사용할 수 없습니다.';
    }
    return `게스트 클라우드 저장 초기화에 실패했습니다.${code ? ` (${code})` : ''}`;
  }

  function createLocalGuestUser() {
    return {
      uid: 'local-guest',
      displayName: '게스트',
      isAnonymous: true,
      isLocalGuest: true,
    };
  }

  async function ensureGuestSignedIn() {
    init();
    await waitForAuthReady();
    if (auth.currentUser?.isAnonymous) {
      isGuestSession = true;
      isLocalGuestSession = false;
      return auth.currentUser;
    }
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      await auth.signOut();
    }
    try {
      const result = await auth.signInAnonymously();
      isGuestSession = true;
      isLocalGuestSession = false;
      return result.user;
    } catch (error) {
      if (!isAnonymousAuthUnavailable(error)) throw error;
      isGuestSession = true;
      isLocalGuestSession = true;
      if (window?.console?.warn) {
        console.warn('[GuestAuth] anonymous auth unavailable; using local guest storage.', error);
      }
      return createLocalGuestUser();
    }
  }

  function isGuestUser(user = auth?.currentUser) {
    return Boolean(isGuestSession || isLocalGuestSession || user?.isAnonymous);
  }

  function getUserDataCollection(user = auth?.currentUser) {
    return isGuestUser(user) ? GUEST_DATA_COLLECTION : USER_DATA_COLLECTION;
  }

  async function promptAuthGate() {
    init();
    await waitForAuthReady();
    if (auth.currentUser?.isAnonymous) {
      isGuestSession = true;
      isLocalGuestSession = false;
      await syncUserCloudData(auth.currentUser);
      return { guest: true, displayName: '게스트' };
    }
    if (isGuestSession) return { guest: true, displayName: '게스트' };
    if (auth.currentUser) return auth.currentUser;

    const overlay = ensureAuthModal();
    const hint = overlay.querySelector('#auth-hint');
    const googleButton = overlay.querySelector('[data-auth-action="google"]');
    const guestButton = overlay.querySelector('[data-auth-action="guest"]');

    if (googleButton) googleButton.textContent = 'Google로 회원가입 및 로그인하기';
    hint.textContent = '';
    overlay.hidden = false;

    return new Promise((resolve, reject) => {
      let done = false;
      const cleanups = [];

      const cleanup = () => {
        while (cleanups.length) cleanups.pop()();
      };
      const finishOk = (user) => {
        if (done) return;
        done = true;
        overlay.hidden = true;
        cleanup();
        resolve(user);
      };
      const finishErr = (error) => {
        if (done) return;
        done = true;
        overlay.hidden = true;
        cleanup();
        reject(error);
      };

      const onGuest = async () => {
        hint.textContent = '게스트 클라우드 저장 공간을 준비하는 중입니다...';
        try {
          const user = await ensureGuestSignedIn();
          if (user.isLocalGuest) {
            hint.textContent = 'Firebase 익명 로그인이 꺼져 있어 로컬 게스트 저장으로 시작합니다.';
            finishOk({ guest: true, localOnly: true, displayName: '게스트' });
            return;
          }
          await syncUserCloudData(user);
          finishOk({ guest: true, displayName: '게스트' });
        } catch (error) {
          if (window?.console?.error) console.error('[GuestAuth] setup failed', error);
          hint.textContent = getGuestSetupErrorMessage(error);
        }
      };

      guestButton?.addEventListener('click', onGuest);
      cleanups.push(() => guestButton?.removeEventListener('click', onGuest));

      const onGoogle = async () => {
        hint.textContent = 'Google 인증 창을 여는 중입니다...';
        try {
          const user = await ensureSignedIn();
          isGuestSession = false;
          isLocalGuestSession = false;
          await syncUserCloudData(user);
          finishOk(user);
        } catch (error) {
          const code = error?.code ?? '';
          if (code.includes('popup-closed')) {
            hint.textContent = '인증 창이 닫혔습니다. 다시 시도해 주세요.';
            return;
          }
          if (code.includes('unauthorized-domain')) {
            hint.textContent = '인증 도메인 설정이 필요합니다.';
            return;
          }
          hint.textContent = '로그인/회원가입 실패. 다시 시도해 주세요.';
        }
      };

      googleButton?.addEventListener('click', onGoogle);
      cleanups.push(() => googleButton?.removeEventListener('click', onGoogle));
    });
  }


  function getShared() {
    return window.UpUpUpShared ?? null;
  }

  function collectLocalUserData() {
    const shared = getShared();
    if (!shared) return null;
    return {
      schemaVersion: 1,
      save: shared.storageReadSave?.() ?? null,
      creditBalance: shared.readCreditBalance?.() ?? 0,
      infiniteBestRecord: shared.readInfiniteBestRecord?.() ?? { score: 0, elapsedMs: null, savedAt: 0 },
      stageProgress: shared.readStageProgress?.() ?? { maxUnlockedStage: 1 },
      themeShop: shared.readThemeShop?.() ?? null,
      updatedAtMs: Date.now(),
    };
  }

  async function applyCloudUserData(data) {
    const shared = getShared();
    if (!shared || !data || typeof data !== 'object') return false;
    if (data.save) {
      await shared.storageWriteSave(data.save, 1, { skipCloudSync: true });
    } else {
      shared.storageDeleteSave?.(1, { skipCloudSync: true });
    }
    if (Number.isFinite(data.creditBalance)) shared.writeCreditBalance(data.creditBalance, { skipCloudSync: true });
    if (data.infiniteBestRecord) await shared.writeInfiniteBestRecord(data.infiniteBestRecord, { skipCloudSync: true });
    if (data.stageProgress) await shared.writeStageProgress(data.stageProgress, { skipCloudSync: true, replace: true });
    if (data.themeShop) shared.writeThemeShop(data.themeShop, { skipCloudSync: true });
    window.dispatchEvent(new CustomEvent('upupup:user-data-cloud-applied', { detail: data }));
    return true;
  }


  async function clearLocalUserData() {
    const shared = getShared();
    if (!shared) return;
    shared.storageDeleteSave?.(1, { skipCloudSync: true });
    shared.writeCreditBalance?.(0, { skipCloudSync: true });
    await shared.writeInfiniteBestRecord?.({ score: 0, elapsedMs: null, savedAt: 0 }, { skipCloudSync: true });
    await shared.writeStageProgress?.({ maxUnlockedStage: 1 }, { skipCloudSync: true, replace: true });
    shared.writeThemeShop?.({ ownedThemes: ['default'], currentTheme: 'default' }, { skipCloudSync: true });
    try { localStorage.removeItem(CLOUD_OWNER_KEY); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('upupup:user-data-cloud-applied', { detail: { cleared: true } }));
  }

  function scoreCloudData(data) {
    if (!data || typeof data !== 'object') return 0;
    return Math.max(
      Number(data.save?.savedAt) || 0,
      Number(data.infiniteBestRecord?.savedAt) || 0,
      Number(data.updatedAtMs) || 0
    );
  }

  async function pushUserCloudData(user = auth?.currentUser) {
    init();
    if (isLocalGuestSession || user?.isLocalGuest) return false;
    if (!db) throw new Error('cloud-firestore-unavailable');
    if (!user) return false;
    const data = collectLocalUserData();
    if (!data) return false;
    await db.collection(getUserDataCollection(user)).doc(user.uid).set({
      ...data,
      uid: user.uid,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  }

  async function syncUserCloudData(user = auth?.currentUser) {
    init();
    if (isLocalGuestSession || user?.isLocalGuest) return false;
    if (!db) throw new Error('cloud-firestore-unavailable');
    if (!user) return false;
    if (user.isAnonymous) isGuestSession = true;
    const ref = db.collection(getUserDataCollection(user)).doc(user.uid);
    const snap = await ref.get();
    const localData = collectLocalUserData();
    const cloudData = snap.exists ? (snap.data() || {}) : null;
    if (cloudData && scoreCloudData(cloudData) >= scoreCloudData(localData)) {
      await applyCloudUserData(cloudData);
    } else {
      await pushUserCloudData(user);
    }
    try { localStorage.setItem(CLOUD_OWNER_KEY, user.uid); } catch { /* ignore */ }
    return true;
  }

  function queueUserDataSync() {
    init();
    if (isLocalGuestSession || !auth.currentUser) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      cloudSyncPromise = cloudSyncPromise
        .then(() => pushUserCloudData(auth.currentUser))
        .catch((error) => {
          if (window?.console?.warn) console.warn('[CloudSave] sync failed', error);
        });
    }, 800);
  }


  async function exportGuestData() {
    init();
    if (!isGuestUser()) throw new Error('guest-export-requires-guest-session');
    const user = isLocalGuestSession ? createLocalGuestUser() : (auth.currentUser ?? await ensureGuestSignedIn());
    if (!user.isLocalGuest) await pushUserCloudData(user);
    const payload = {
      schema: 'upupup.io.guest-cloud-export.v1',
      guestUid: user.uid,
      exportedAt: Date.now(),
      data: collectLocalUserData(),
    };
    return JSON.stringify(payload, null, 2);
  }

  async function importGuestData(raw) {
    init();
    const text = String(raw ?? '').trim();
    if (!text) throw new Error('guest-import-empty');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('guest-import-invalid-json');
    }
    const data = parsed?.schema === 'upupup.io.guest-cloud-export.v1' ? parsed.data : parsed;
    if (!data || typeof data !== 'object') throw new Error('guest-import-invalid-data');
    if (!isGuestUser()) throw new Error('guest-import-requires-guest-session');
    const user = isLocalGuestSession ? createLocalGuestUser() : (auth.currentUser ?? await ensureGuestSignedIn());
    await applyCloudUserData(data);
    if (!user.isLocalGuest) await pushUserCloudData(user);
    return true;
  }


  async function hasEditorAccess(user = null) {
    init();
    const targetUser = user ?? auth.currentUser;
    if (!targetUser?.getIdTokenResult) return false;

    const tokenResult = await targetUser.getIdTokenResult(true);
    const claims = tokenResult?.claims ?? {};
    return EDITOR_ACCESS_CLAIMS.some((claimName) => claims[claimName] === true);
  }

  async function requireEditorAccess() {
    const user = await ensureSignedIn();
    if (await hasEditorAccess(user)) return user;

    const error = new Error('editor-permission-denied');
    error.code = 'editor-permission-denied';
    throw error;
  }

  function normalizeNickname(name) {
    return String(name ?? '').trim().slice(0, 20);
  }

  function normalizeScore(score) {
    return Math.max(0, Math.floor(Number(score) || 0));
  }

  async function upsertInfiniteRanking({ nickname, score, elapsedMs }) {
    init();
    if (!db) throw new Error('Firestore SDK not loaded');
    const user = auth.currentUser;
    if (!user || isGuestSession) throw new Error('Authentication required');

    const ref = db.collection(LEADERBOARD_COLLECTION).doc(user.uid);
    const safeNickname = normalizeNickname(nickname) || user.displayName || '익명';
    const safeScore = normalizeScore(score);
    const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs)) : null;
    const payload = {
      uid: user.uid,
      nickname: safeNickname,
      score: safeScore,
      elapsedMs: safeElapsedMs,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    };

    await ref.set(payload, { merge: true });
    return { uid: user.uid, nickname: safeNickname, score: safeScore, elapsedMs: safeElapsedMs };
  }

  async function getInfiniteRanking(limit = LEADERBOARD_LIMIT) {
    init();
    if (!db) return [];
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || LEADERBOARD_LIMIT)));
    const snap = await db
      .collection(LEADERBOARD_COLLECTION)
      .orderBy('score', 'desc')
      .orderBy('updatedAt', 'asc')
      .limit(safeLimit)
      .get();

    return snap.docs.map((doc, index) => {
      const data = doc.data() || {};
      return {
        rank: index + 1,
        uid: data.uid || doc.id,
        nickname: normalizeNickname(data.nickname) || '익명',
        score: normalizeScore(data.score),
      };
    });
  }

  function subscribeInfiniteRanking(callback, limit = LEADERBOARD_LIMIT) {
    init();
    if (!db || typeof callback !== 'function') return () => {};
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || LEADERBOARD_LIMIT)));
    return db
      .collection(LEADERBOARD_COLLECTION)
      .orderBy('score', 'desc')
      .orderBy('updatedAt', 'asc')
      .limit(safeLimit)
      .onSnapshot((snap) => {
        const items = snap.docs.map((doc, index) => {
          const data = doc.data() || {};
          return {
            rank: index + 1,
            uid: data.uid || doc.id,
            nickname: normalizeNickname(data.nickname) || '익명',
            score: normalizeScore(data.score),
          };
        });
        callback(items);
      }, (error) => {
        if (window?.console?.error) console.error('[Ranking] subscribeInfiniteRanking failed', error);
        callback(null, error);
      });
  }

  async function getMyInfiniteRanking() {
    init();
    if (!db || !auth.currentUser) return null;
    const ref = db.collection(LEADERBOARD_COLLECTION).doc(auth.currentUser.uid);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return {
      uid: snap.id,
      nickname: normalizeNickname(data.nickname) || '익명',
      score: normalizeScore(data.score),
      elapsedMs: Number.isFinite(data.elapsedMs) ? Math.max(0, Math.floor(data.elapsedMs)) : null,
    };
  }

  async function signOut() {
    init();
    if (auth.currentUser) {
      try { await pushUserCloudData(auth.currentUser); } catch { /* ignore sign-out sync failures */ }
    }
    isGuestSession = false;
    isLocalGuestSession = false;
    if (auth.currentUser) await auth.signOut();
    await clearLocalUserData();
  }

  window.UpUpUpAuth = {
    init,
    ensureSignedIn,
    ensureGuestSignedIn,
    promptAuthGate,
    hasEditorAccess,
    requireEditorAccess,
    getUser: () => {
      init();
      return isGuestUser() ? null : auth.currentUser;
    },
    isGuest: () => isGuestUser(),
    isLocalGuest: () => isLocalGuestSession,
    onAuthChanged: (callback) => {
      init();
      return auth.onAuthStateChanged(callback);
    },
    signOut,
    getAnalytics: () => analytics,
    waitForAuthReady,
    syncUserCloudData,
    pushUserCloudData,
    queueUserDataSync,
    exportGuestData,
    importGuestData,
    clearLocalUserData,
    upsertInfiniteRanking,
    getInfiniteRanking,
    subscribeInfiniteRanking,
    getMyInfiniteRanking,
  };
})();
