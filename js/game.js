(() => {
  const {
    storageReadSave,
    readStartMode,
    clearStartMode,
  } = window.UpUpUpShared;

  const shell = window.UpUpUpUI.createUIController();
  const initialSave = storageReadSave();
  const startMode = readStartMode();
  const audio = window.UpUpUpAudio?.createAudioManager?.(shell.getPreferences().audioVolume) ?? null;
  const canvas = document.getElementById('game-canvas');

  let gameInstance = null;

  function beginGame(mode, save) {
    if (gameInstance) return;
    clearStartMode();
    shell.setMenuVisible(false);
    shell.setChromeVisible(false);
    shell.setPanelOpen(false);
    audio?.unlock();
    gameInstance = window.UpUpUpRuntime.startGame({
      canvas,
      shell,
      initialSave: save,
      audio,
    });
  }

  function startFreshGame() {
    const hasSave = Boolean(initialSave);
    if (hasSave) {
      const shouldStartFresh = window.confirm('이미 저장된 진행이 있습니다. 처음부터 시작할까요?');
      if (!shouldStartFresh) return;
    }
    beginGame('play', null);
  }

  function startContinueGame() {
    if (!initialSave) return;
    beginGame('continue', initialSave);
  }

  shell.updateMenuState(initialSave);

  shell.setActions({
    onStartNewGame: startFreshGame,
    onContinueGame: startContinueGame,
    onSetAudioVolume: (volume) => {
      audio?.setVolume(volume);
    },
  });

  if (startMode === 'play') {
    beginGame('play', null);
    return;
  }

  if (startMode === 'continue') {
    beginGame('continue', initialSave);
    return;
  }

  shell.setMenuVisible(true);
  shell.setChromeVisible(true);
  shell.setPanelOpen(false);
})();
