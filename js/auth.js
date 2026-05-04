(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyBCeHx5RAPQZSN_D-E8wPqIqv-JDv4rpnU',
    authDomain: 'upupupio.firebaseapp.com',
    projectId: 'upupupio',
    storageBucket: 'upupupio.firebasestorage.app',
    messagingSenderId: '412158488389',
    appId: '1:412158488389:web:0d6a548d0bddaaaca6182c',
    measurementId: 'G-RS93066VTN',
  };

  let app = null;
  let auth = null;
  let googleProvider = null;
  let analytics = null;
  let authModal = null;

  function init() {
    if (app) return;
    if (!window.firebase || !window.firebase.auth) {
      throw new Error('Firebase SDK not loaded');
    }

    app = window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(firebaseConfig);
    auth = window.firebase.auth();
    googleProvider = new window.firebase.auth.GoogleAuthProvider();

    if (window.firebase.analytics) {
      analytics = window.firebase.analytics();
    }
  }

  function ensureAuthModal() {
    if (authModal) return authModal;

    const overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title" class="auth-title">무한 모드 로그인</h2>
        <p class="auth-desc">무한 모드를 하려면 먼저 로그인 또는 회원가입이 필요합니다.</p>

        <div class="auth-tab-row" role="tablist" aria-label="인증 선택">
          <button class="auth-tab is-active" data-auth-tab="login" aria-selected="true" type="button">로그인</button>
          <button class="auth-tab" data-auth-tab="signup" aria-selected="false" type="button">회원가입</button>
        </div>

        <div class="auth-panel" data-auth-panel="login">
          <button class="auth-google-btn" data-auth-action="login" type="button">Google로 로그인</button>
        </div>
        <div class="auth-panel" data-auth-panel="signup" hidden>
          <button class="auth-google-btn" data-auth-action="signup" type="button">Google로 회원가입</button>
        </div>

        <p class="auth-hint" id="auth-hint" aria-live="polite"></p>
        <button class="auth-cancel-btn" type="button">취소</button>
      </div>
    `;

    document.body.appendChild(overlay);
    authModal = overlay;
    return authModal;
  }

  function setAuthTab(tab) {
    if (!authModal) return;
    const tabs = authModal.querySelectorAll('[data-auth-tab]');
    const panels = authModal.querySelectorAll('[data-auth-panel]');

    tabs.forEach((btn) => {
      const active = btn.dataset.authTab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== tab;
    });
  }

  async function ensureSignedIn() {
    init();
    if (auth.currentUser) return auth.currentUser;
    const result = await auth.signInWithPopup(googleProvider);
    return result.user;
  }

  async function promptAuthGate() {
    init();
    if (auth.currentUser) return auth.currentUser;

    const overlay = ensureAuthModal();
    const hint = overlay.querySelector('#auth-hint');
    const cancelBtn = overlay.querySelector('.auth-cancel-btn');
    const tabButtons = Array.from(overlay.querySelectorAll('[data-auth-tab]'));
    const actionButtons = Array.from(overlay.querySelectorAll('[data-auth-action]'));

    setAuthTab('login');
    hint.textContent = '';
    overlay.hidden = false;

    return new Promise((resolve, reject) => {
      let done = false;
      const cleanups = [];

      function cleanup() {
        while (cleanups.length) {
          const fn = cleanups.pop();
          fn();
        }
      }

      function finishOk(user) {
        if (done) return;
        done = true;
        overlay.hidden = true;
        cleanup();
        resolve(user);
      }

      function finishErr(error) {
        if (done) return;
        done = true;
        overlay.hidden = true;
        cleanup();
        reject(error);
      }

      function onCancel() {
        finishErr(new Error('auth-cancelled-by-user'));
      }

      cancelBtn.addEventListener('click', onCancel);
      cleanups.push(() => cancelBtn.removeEventListener('click', onCancel));

      for (const tabBtn of tabButtons) {
        const handler = () => setAuthTab(tabBtn.dataset.authTab);
        tabBtn.addEventListener('click', handler);
        cleanups.push(() => tabBtn.removeEventListener('click', handler));
      }

      for (const actionBtn of actionButtons) {
        const handler = async () => {
          hint.textContent = 'Google 인증 창을 여는 중입니다...';
          try {
            const user = await ensureSignedIn();
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
        actionBtn.addEventListener('click', handler);
        cleanups.push(() => actionBtn.removeEventListener('click', handler));
      }
    });
  }

  async function signOut() {
    init();
    await auth.signOut();
  }

  window.UpUpUpAuth = {
    init,
    ensureSignedIn,
    promptAuthGate,
    getUser: () => {
      init();
      return auth.currentUser;
    },
    onAuthChanged: (callback) => {
      init();
      return auth.onAuthStateChanged(callback);
    },
    signOut,
    getAnalytics: () => analytics,
  };
})();
