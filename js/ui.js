(() => {
  const {
    formatTime,
    numberOr,
    readPrefs,
    writePrefs,
    readStartMode,
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
    const audioVolumeSlider = document.getElementById('audio-volume-slider');
    const audioVolumeValue = document.getElementById('audio-volume-value');
    const saveStatus = document.getElementById('save-status');

    const prefs = readPrefs();
    let autoSaveEnabled = prefs.autoSaveEnabled;
    let gridVisible = prefs.gridVisible;
    let audioVolume = prefs.audioVolume;
    let activeTab = 'game';

    let actions = {
      onStartNewGame: () => setStatus('게임이 시작된 뒤 사용할 수 있습니다.'),
      onContinueGame: () => setStatus('게임이 시작된 뒤 사용할 수 있습니다.'),
      onSetGridVisible: () => undefined,
      onQuit: () => setStatus('게임이 시작된 뒤 사용할 수 있습니다.'),
      onSetAudioVolume: () => undefined,
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
        menuCreditBalance.textContent = `보유 크레딧 ${numberOr(balance, 0)}`;
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
      writePrefs({ autoSaveEnabled, gridVisible, audioVolume });
    }

    function toggleGridVisible() {
      const nextVisible = !gridVisible;
      setGridVisible(nextVisible);
      actions.onSetGridVisible?.(nextVisible);
    }

    function setAutosaveEnabled(enabled) {
      autoSaveEnabled = Boolean(enabled);
      writePrefs({ autoSaveEnabled, gridVisible, audioVolume });
    }

    function syncAudioVolumeUI() {
      if (audioVolumeSlider) {
        audioVolumeSlider.value = String(Math.round(audioVolume * 100));
        audioVolumeSlider.style.setProperty('--fill', `${Math.round(audioVolume * 100)}%`);
      }
      if (audioVolumeValue) {
        audioVolumeValue.textContent = `${Math.round(audioVolume * 100)}%`;
      }
    }

    function setAudioVolume(volume) {
      audioVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : audioVolume));
      writePrefs({ autoSaveEnabled, gridVisible, audioVolume });
      syncAudioVolumeUI();
      window.UpUpUpAudio?.getAudioManager?.()?.setVolume(audioVolume);
      actions.onSetAudioVolume(audioVolume);
    }

    function bind() {
      menuPlayBtn.addEventListener('click', () => {
        actions.onStartNewGame();
      });

      menuContinueBtn.addEventListener('click', () => {
        if (menuContinueBtn.disabled) return;
        actions.onContinueGame();
      });

      for (const button of menuTabButtons) {
        button.addEventListener('click', () => {
          setActiveTab(button.dataset.menuTab);
        });
      }

      gridToggleBtn.addEventListener('click', () => {
        toggleGridVisible();
      });

      if (audioVolumeSlider) {
        audioVolumeSlider.addEventListener('input', (event) => {
          setAudioVolume(Number(event.target.value) / 100);
        });
      }
    }

    bind();
    setActiveTab(activeTab);
    updateMenuState(storageReadSave());
    setCreditBalance(storageReadSave()?.credits);
    setGridVisible(gridVisible);
    setAutosaveEnabled(autoSaveEnabled);
    syncAudioVolumeUI();

    return {
      getPreferences() {
        return { autoSaveEnabled, gridVisible, audioVolume };
      },
      setActions,
      setStatus,
      setPanelOpen,
      setMenuVisible,
      setChromeVisible,
      setCreditBalance,
      updateMenuState,
      setGridVisible,
      toggleGridVisible,
      setAutosaveEnabled,
      setAudioVolume,
      readStartMode,
      setActiveTab,
    };
  }

  window.UpUpUpUI = { createUIController };
})();
