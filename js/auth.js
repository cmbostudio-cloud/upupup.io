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

    if (window.location.hostname === 'localhost') {
      auth.useDeviceLanguage();
    }
  }

  function getUser() {
    init();
    return auth.currentUser;
  }

  function onAuthChanged(callback) {
    init();
    return auth.onAuthStateChanged(callback);
  }

  async function ensureSignedIn() {
    init();

    if (auth.currentUser) {
      return auth.currentUser;
    }

    const result = await auth.signInWithPopup(googleProvider);
    return result.user;
  }

  async function signOut() {
    init();
    await auth.signOut();
  }

  window.UpUpUpAuth = {
    init,
    getUser,
    onAuthChanged,
    ensureSignedIn,
    signOut,
    getAnalytics: () => analytics,
  };
})();
