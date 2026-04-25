void (async () => {
  const { ready, storageReadSave, storageDeleteSave, readCreditBalance, writeStartMode } = window.UpUpUpShared;
  await ready;

  const shell = window.UpUpUpUI.createUIController();
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

  function startInfiniteMode() {
    shell.setStatus('무한 모드를 선택하세요.');
    shell.setGameView?.('infinite');
  }

  function startStageMode() {
    shell.setStatus('스테이지를 선택하세요.');
    shell.setGameView?.('stages');
  }

  function startInfiniteNew() {
    beginGame({
      mode: 'infinite',
      stage: 1,
      save: null,
    });
  }

  function continueInfinite() {
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

  shell.setMenuVisible(true);
})();
