(() => {
  const { storageReadSave, readStartMode, clearStartMode } = window.UpUpUpShared;
  const shell = window.UpUpUpUI.createUIController();
  const initialSave = storageReadSave();
  const startMode = readStartMode();

  shell.updateMenuState(initialSave);

  if (startMode === 'menu') {
    shell.setMenuVisible(true);
    shell.setChromeVisible(true);
    shell.setPanelOpen(false);
    return;
  }

  shell.setMenuVisible(false);
  shell.setChromeVisible(false);
  shell.setPanelOpen(false);
  clearStartMode();

  window.UpUpUpRuntime.startGame({
    canvas: document.getElementById('game-canvas'),
    shell,
    initialSave: startMode === 'continue' ? initialSave : null,
  });
})();
