(() => {
  const {
    formatTime,
    numberOr,
    readPrefs,
    writePrefs,
    readStartMode,
    writeStartMode,
    storageReadSave,
  } = window.UpUpUpShared;

  function createUIController() {
    const menuOverlay = document.getElementById('menu-overlay');
    const menuCreditBalance = document.getElementById('menu-credit-balance');
    const menuPlayBtn = document.getElementById('menu-play-btn');
    const menuContinueBtn = document.getElementById('menu-continue-btn');
    const menuContinueNote = document.getElementById('menu-continue-note');
    const menuTabButtons = Array.from(document.querySelectorAll('[data-menu-tab]'));
    const menuPanels = Array.from(document.querySelectorAll('[data-menu-panel]'));
    const gridToggleBtn = document.getElementById('grid-toggle-btn');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const autosaveBtn = document.getElementById('autosave-btn');
    const saveStatus = document.getElementById('save-status');

    const prefs = readPrefs();
    let autoSaveEnabled = prefs.autoSaveEnabled;
    let gridVisible = prefs.gridVisible;
    let activeTab = 'game';

    let actions = {
      onToggleGrid: () => setStatus('게임이 시작되어야 사용할 수 있습니다.'),
      onSave: () => setStatus('게임이 시작되어야 사용할 수 있습니다.'),
      onLoad: () => setStatus('게임이 시작되어야 사용할 수 있습니다.'),
      onQuit: () => setStatus('게임이 시작되어야 사용할 수 있습니다.'),
      onToggleAutosave: () => setStatus('게임이 시작되어야 사용할 수 있습니다.'),
    };

    function setActions(nextActions = {}) {
      actions = { ...actions, ...nextActions };
    }

    function setStatus(message) {
      if (saveStatus) {
        saveStatus.textContent = message;
      }
    }

    function setActiveTab(tabName) {
      const nextTab = menuPanels.some((panel) => panel.dataset.menuPanel === tabName)
        ? tabName
        : 'game';
      activeTab = nextTab;

      for (const button of menuTabButtons) {
        button.setAttribute('aria-selected', String(button.dataset.menuTab === nextTab));
      }

      for (const panel of menuPanels) {
        const isActive = panel.dataset.menuPanel === nextTab;
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      }
    }

    function setMenuVisible(visible) {
      menuOverlay.style.display = visible ? 'flex' : 'none';
      if (visible) {
        setActiveTab(activeTab);
      }
    }

    function setChromeVisible() {
      return undefined;
    }

    function setPanelOpen() {
      return undefined;
    }

    function setCreditBalance(balance) {
      if (menuCreditBalance) {
        menuCreditBalance.textContent = `보유 크레딧: ${numberOr(balance, 0)}`;
      }
    }

    function updateMenuState(saved) {
      const hasSave = Boolean(saved);
      menuContinueBtn.hidden = !hasSave;
      menuContinueBtn.disabled = !hasSave;
      menuContinueNote.textContent = hasSave
        ? `마지막 저장: ${formatTime(saved.savedAt ?? Date.now())} · 최고 ${numberOr(saved.score, 0)}점`
        : '저장된 진행이 아직 없습니다.';
    }

    function setGridVisible(visible) {
      gridVisible = Boolean(visible);
      gridToggleBtn.textContent = gridVisible ? '격자 켜짐' : '격자 꺼짐';
      writePrefs({ autoSaveEnabled, gridVisible });
    }

    function setAutosaveEnabled(enabled) {
      autoSaveEnabled = Boolean(enabled);
      autosaveBtn.textContent = autoSaveEnabled ? '자동 저장 켜짐' : '자동 저장 꺼짐';
      writePrefs({ autoSaveEnabled, gridVisible });
    }

    function startNewGame() {
      const hasSave = Boolean(storageReadSave());
      if (hasSave) {
        const shouldStartFresh = window.confirm('이미 하던 게 있다면 정말 처음부터 진행하시겠습니까?');
        if (!shouldStartFresh) return;
      }
      writeStartMode('play');
      window.location.reload();
    }

    function bind() {
      menuPlayBtn.addEventListener('click', startNewGame);

      menuContinueBtn.addEventListener('click', () => {
        if (menuContinueBtn.disabled) return;
        writeStartMode('continue');
        window.location.reload();
      });

      for (const button of menuTabButtons) {
        button.addEventListener('click', () => {
          setActiveTab(button.dataset.menuTab);
        });
      }

      gridToggleBtn.addEventListener('click', () => {
        actions.onToggleGrid();
      });

      saveBtn.addEventListener('click', () => {
        actions.onSave();
      });

      loadBtn.addEventListener('click', () => {
        actions.onLoad();
      });

      autosaveBtn.addEventListener('click', () => {
        actions.onToggleAutosave();
      });
    }

    bind();
    setActiveTab(activeTab);
    updateMenuState(storageReadSave());
    setCreditBalance(storageReadSave()?.credits);
    setGridVisible(gridVisible);
    setAutosaveEnabled(autoSaveEnabled);

    return {
      getPreferences() {
        return { autoSaveEnabled, gridVisible };
      },
      setActions,
      setStatus,
      setPanelOpen,
      setMenuVisible,
      setChromeVisible,
      setCreditBalance,
      updateMenuState,
      setGridVisible,
      setAutosaveEnabled,
      readStartMode,
      setActiveTab,
    };
  }

  window.UpUpUpUI = { createUIController };
})();
