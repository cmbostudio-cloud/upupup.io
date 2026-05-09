void (async () => {
  const t = (key, values = {}) => window.UpUpUpI18n?.t?.(key, values) ?? key;
  const { ready, storageReadSave, storageDeleteSave, readCreditBalance, writeStartMode } = window.UpUpUpShared;
  await ready;

  const shell = window.UpUpUpUI.createUIController();
  const auth = window.UpUpUpAuth;
  let initialSave = storageReadSave();
  const audio = window.UpUpUpAudio?.createAudioManager?.(shell.getPreferences().audioVolume) ?? null;
  const canvas = document.getElementById('game-canvas');

  let gameInstance = null;

  function beginGame({ mode = 'infinite', stage = 1, save = null } = {}) {
    if (gameInstance) return;

    shell.setMenuVisible(false);
    audio?.unlock?.();

    gameInstance = window.UpUpUpRuntime.startGame({
      canvas,
      shell,
      initialSave: save,
      audio,
      mode,
      stage,
    });
  }

  async function requireInfiniteAuth() {
    if (!auth) {
      shell.setStatus(t('status.loginRequired'));
      return false;
    }

    try {
      await auth.waitForAuthReady?.();
      const user = await auth.promptAuthGate();
      if (!user) {
        shell.setStatus(t('status.loginRequired'));
        return false;
      }
      return true;
    } catch (error) {
      const code = error?.code ?? '';
      if (code.includes('popup-closed')) {
        shell.setStatus(t('auth.popupClosed'));
        shell.setGameView?.('modes');
      } else if (code.includes('unauthorized-domain')) {
        shell.setStatus(t('auth.unauthorizedDomain'));
      } else if (code.includes('operation-not-allowed')) {
        shell.setStatus(t('auth.operationNotAllowed'));
      } else if (code.includes('network-request-failed')) {
        shell.setStatus(t('auth.networkFailed'));
      } else {
        shell.setStatus(t('auth.failed'));
      }

      console.error('[InfiniteAuth] Google sign-in failed:', code, error);
      return false;
    }
  }

  async function startInfiniteMode() {
    const passed = await requireInfiniteAuth();
    if (!passed) return;

    shell.setStatus(t('status.selectInfinite'));
    shell.setGameView?.('infinite');
  }

  function startStageMode() {
    shell.setStatus(t('status.selectStage'));
    shell.setGameView?.('stages');
  }

  async function startInfiniteNew() {
    const passed = await requireInfiniteAuth();
    if (!passed) return;

    beginGame({
      mode: 'infinite',
      stage: 1,
      save: null,
    });
  }

  async function continueInfinite() {
    const passed = await requireInfiniteAuth();
    if (!passed) return;

    const latestSave = storageReadSave();
    const saved = latestSave && latestSave.mode === 'infinite'
      ? latestSave
      : null;
    beginGame({
      mode: 'infinite',
      stage: 1,
      save: saved,
    });
  }

  function abandonInfinite() {
    const hadInfiniteSave = storageReadSave()?.mode === 'infinite';
    const deleted = storageDeleteSave?.();
    if (!deleted) {
      shell.setStatus(t('status.abandonFailed'));
      return;
    }

    writeStartMode('menu');
    shell.updateMenuState(null);
    shell.setCreditBalance(readCreditBalance());
    shell.setGameView?.('modes');
    shell.setMenuVisible(true);
    shell.setStatus(hadInfiniteSave
      ? t('status.abandonDone')
      : t('status.noAbandonSave'));
  }

  function startStage(stageNumber) {
    const stage = Math.max(1, Math.floor(Number(stageNumber) || 1));
    beginGame({
      mode: 'stage',
      stage,
      save: null,
    });
  }

  shell.updateMenuState(initialSave);
  shell.setCreditBalance(readCreditBalance());

  shell.setActions({
    onStartStageMode: startStageMode,
    onStartInfiniteMode: startInfiniteMode,
    onStartInfiniteNew: startInfiniteNew,
    onContinueInfinite: continueInfinite,
    onAbandonInfinite: abandonInfinite,
    onStartStage: startStage,
    onSetAudioVolume: (volume) => {
      audio?.setVolume(volume);
    },
  });

  async function completeInitialAuth() {
    await auth.promptAuthGate();
    initialSave = storageReadSave();
    shell.updateMenuState(initialSave);
    shell.setCreditBalance(readCreditBalance());
    shell.refreshAccountState?.();
    shell.setStatus(auth.isLocalGuest?.()
      ? t('status.localGuestStart')
      : auth.isGuest?.()
        ? t('status.cloudGuestStart')
        : t('status.googleStart'));
  }

  shell.setMenuVisible(false);
  if (auth?.waitForAuthReady) {
    try {
      await completeInitialAuth();
    } catch (error) {
      console.warn('[CloudSave] initial auth failed:', error);
      shell.setStatus(t('status.chooseLogin'));
      try {
        await completeInitialAuth();
      } catch {
        shell.setStatus(t('status.authRequired'));
      }
    }
  }
  shell.setMenuVisible(true);
})();
