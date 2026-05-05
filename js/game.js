void (async () => {
  const { ready, storageReadSave, storageDeleteSave, readCreditBalance, writeStartMode } = window.UpUpUpShared;
  await ready;

  const shell = window.UpUpUpUI.createUIController();
  const auth = window.UpUpUpAuth;
  const initialSave = storageReadSave();
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
      shell.setStatus('인증 모듈을 찾을 수 없습니다.');
      return false;
    }

    try {
      await auth.waitForAuthReady?.();
      const user = await auth.promptAuthGate();
      if (!user) {
        shell.setStatus('로그인이 필요합니다.');
        return false;
      }
      return true;
    } catch (error) {
      const code = error?.code ?? '';
      if ((error?.message ?? '').includes('auth-cancelled-by-user') || code.includes('popup-closed')) {
        shell.setStatus('로그인/회원가입이 취소되었습니다.');
        shell.setGameView?.('modes');
      } else if (code.includes('unauthorized-domain')) {
        shell.setStatus('Firebase 인증 도메인이 설정되지 않았습니다. 관리자에게 문의하세요.');
      } else if (code.includes('operation-not-allowed')) {
        shell.setStatus('Firebase 콘솔에서 Google 로그인이 비활성화되어 있습니다.');
      } else if (code.includes('network-request-failed')) {
        shell.setStatus('네트워크 오류로 로그인에 실패했습니다.');
      } else {
        shell.setStatus('로그인에 실패했습니다. 다시 시도해 주세요.');
      }

      console.error('[InfiniteAuth] Google sign-in failed:', code, error);
      return false;
    }
  }

  async function startInfiniteMode() {
    const passed = await requireInfiniteAuth();
    if (!passed) return;

    shell.setStatus('무한 모드를 선택하세요.');
    shell.setGameView?.('infinite');
  }

  function startStageMode() {
    shell.setStatus('스테이지를 선택하세요.');
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
      shell.setStatus('무한 모드를 포기하는 데 실패했습니다.');
      return;
    }

    writeStartMode('menu');
    shell.updateMenuState(null);
    shell.setCreditBalance(readCreditBalance());
    shell.setGameView?.('modes');
    shell.setMenuVisible(true);
    shell.setStatus(hadInfiniteSave
      ? '무한 모드를 포기했습니다.'
      : '포기할 무한 모드가 없습니다.');
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

  shell.setMenuVisible(false);
  if (auth?.promptAuthGate) {
    try {
      await auth.promptAuthGate();
      shell.setStatus('로그인되었습니다.');
    } catch {
      shell.setStatus('로그인 후 이용할 수 있습니다.');
    }
  }
  shell.setMenuVisible(true);
})();
