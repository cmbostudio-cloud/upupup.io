(() => {
  const i18n = window.UpUpUpI18n;
  const t = (key, values = {}) => i18n?.t?.(key, values) ?? key;

  const {
    formatTime,
    numberOr,
    readPrefs,
    readInfiniteBestRecord,
    writePrefs,
    writeThemeShop,
    storageReadSave,
    hasStageEditorStage,
    getUnlockedStageLimit,
  } = window.UpUpUpShared;

  function createUIController() {
    const menuOverlay = document.getElementById('menu-overlay');
    const editorAccessBtn = document.getElementById('editor-access-btn');
    const gamePanel = document.querySelector('[data-menu-panel="game"]');
    const menuCreditBalance = document.getElementById('menu-credit-balance');
    const menuPlayBtn = document.getElementById('menu-play-btn');
    const menuContinueBtn = document.getElementById('menu-continue-btn');
    const menuContinueNote = document.getElementById('menu-continue-note');
    const menuTabButtons = Array.from(document.querySelectorAll('[data-menu-tab]'));
    const menuPanels = Array.from(document.querySelectorAll('[data-menu-panel]'));
    const gridToggleBtn = document.getElementById('grid-toggle-btn');
    const audioVolumeSlider = document.getElementById('audio-volume-slider');
    const audioVolumeValue = document.getElementById('audio-volume-value');
    const menuLogoutBtn = document.getElementById('menu-logout-btn');
    const languageSelect = document.getElementById('language-select');
    const languageLabel = document.getElementById('language-label');
    const languageDesc = document.getElementById('language-desc');
    const guestCloudControls = document.getElementById('guest-cloud-controls');
    const guestExportBtn = document.getElementById('guest-export-btn');
    const guestImportBtn = document.getElementById('guest-import-btn');
    const guestImportFile = document.getElementById('guest-import-file');
    const saveStatus = document.getElementById('save-status');
    const shopThemeGrid = document.getElementById('shop-theme-grid');
    const shopThemeStatus = document.getElementById('shop-theme-status');
    const skinSubtabButtons = Array.from(document.querySelectorAll('[data-skin-tab]'));
    const skinSubpanels = Array.from(document.querySelectorAll('[data-skin-panel]'));
    const gameTitle = gamePanel?.querySelector('.menu-title');
    const menuActions = gamePanel?.querySelector('.menu-actions');
    const stageClearPopup = document.createElement('div');
    stageClearPopup.className = 'stage-clear-popup';
    stageClearPopup.hidden = true;
    stageClearPopup.innerHTML = `
      <div class="stage-clear-panel" role="dialog" aria-modal="true" aria-labelledby="stage-clear-title" aria-describedby="stage-clear-desc">
        <span class="stage-clear-kicker">${t('stage.clear.kicker')}</span>
        <h2 id="stage-clear-title" class="stage-clear-title">${t('stage.clear.title')}</h2>
        <p id="stage-clear-desc" class="stage-clear-desc">${t('stage.clear.desc')}</p>
        <div class="stage-clear-reward" aria-live="polite">
          <span class="stage-clear-reward-label">${t('stage.clear.rewardLabel')}</span>
          <span id="stage-clear-reward-value" class="stage-clear-reward-value">${t('stage.clear.reward', { reward: 5 })}</span>
        </div>
        <button id="stage-clear-confirm-btn" class="panel-button secondary stage-clear-confirm-btn" type="button">${t('stage.clear.confirm')}</button>
      </div>
    `;

    const abandonWarningPopup = document.createElement('div');
    abandonWarningPopup.className = 'abandon-warning-popup';
    abandonWarningPopup.hidden = true;
    abandonWarningPopup.innerHTML = `
      <div class="abandon-warning-panel" role="dialog" aria-modal="true" aria-labelledby="abandon-warning-title" aria-describedby="abandon-warning-desc">
        <span class="abandon-warning-kicker">${t('abandon.kicker')}</span>
        <h2 id="abandon-warning-title" class="abandon-warning-title">${t('abandon.title')}</h2>
        <p id="abandon-warning-desc" class="abandon-warning-desc">${t('abandon.desc')}</p>
        <div class="abandon-warning-actions">
          <button id="abandon-cancel-btn" class="panel-button secondary abandon-cancel-btn" type="button">${t('cancel')}</button>
          <button id="abandon-confirm-btn" class="panel-button secondary abandon-confirm-btn" type="button">${t('abandon.confirm')}</button>
        </div>
      </div>
    `;

    const prefs = readPrefs();
    let autoSaveEnabled = prefs.autoSaveEnabled;
    let gridVisible = prefs.gridVisible;
    let audioVolume = prefs.audioVolume;
    let language = i18n?.readLanguage?.() ?? i18n?.normalizeLanguage?.(prefs.language) ?? 'ko';
    let menuVisible = true;
    let ownedThemes = Array.isArray(prefs.ownedThemes) ? prefs.ownedThemes : ['default'];
    let currentTheme = typeof prefs.currentTheme === 'string' ? prefs.currentTheme : 'default';
    let creditBalance = 0;
    let activeTab = 'game';
    let activeSkinTab = 'skins';
    let gameView = 'modes';

    const stageCount = 50;

    const stageSelectPanel = document.createElement('div');
    stageSelectPanel.id = 'stage-select-panel';
    stageSelectPanel.className = 'mode-select-panel stage-select-panel';
    stageSelectPanel.hidden = true;
    stageSelectPanel.innerHTML = `
      <div class="mode-select-head stage-select-head">
        <button id="stage-back-btn" class="panel-button secondary stage-back-btn" type="button">
          <span class="panel-button-title">${t('back.title')}</span>
          <span class="panel-button-desc">${t('back.desc')}</span>
        </button>
        <div class="mode-select-copy stage-select-copy">
          <h3 class="menu-panel-title">${t('stageSelect.title')}</h3>
        </div>
      </div>
      <div id="stage-grid" class="stage-grid" aria-label="Stage list"></div>
    `;

    const infiniteSelectPanel = document.createElement('div');
    infiniteSelectPanel.id = 'infinite-select-panel';
    infiniteSelectPanel.className = 'mode-select-panel infinite-select-panel';
    infiniteSelectPanel.hidden = true;
    infiniteSelectPanel.innerHTML = `
      <div class="mode-select-head infinite-select-head">
        <button id="infinite-back-btn" class="panel-button secondary infinite-back-btn" type="button">
          <span class="panel-button-title">${t('back.title')}</span>
          <span class="panel-button-desc">${t('back.desc')}</span>
        </button>
        <div class="mode-select-copy infinite-select-copy">
          <h3 class="menu-panel-title">${t('infinite.title')}</h3>
        </div>
      </div>
      <div class="infinite-action-row">
        <button id="infinite-new-btn" class="panel-button secondary" type="button">
          <span class="panel-button-title">${t('infinite.new.title')}</span>
          <span class="panel-button-desc">${t('infinite.new.desc')}</span>
        </button>
        <button id="infinite-continue-btn" class="panel-button secondary" type="button">
          <span class="panel-button-title">${t('infinite.continue.title')}</span>
          <span class="panel-button-desc">${t('infinite.continue.desc')}</span>
        </button>
      </div>
    `;

    const infiniteAbandonBtn = document.createElement('button');
    infiniteAbandonBtn.id = 'infinite-abandon-btn';
    infiniteAbandonBtn.type = 'button';
    infiniteAbandonBtn.className = 'infinite-abandon-btn';
    infiniteAbandonBtn.textContent = t('infinite.abandon');
    infiniteSelectPanel.appendChild(infiniteAbandonBtn);

    const rankingPanel = document.createElement('div');
    rankingPanel.className = 'infinite-ranking-panel';
    rankingPanel.innerHTML = `
      <div class="ranking-head">
        <h4 class="ranking-title">${t('ranking.title')}</h4>
        <p id="ranking-my-status" class="ranking-my-status">${t('ranking.guestStatus')}</p>
      </div>
      <div class="ranking-nickname-row">
        <input id="ranking-nickname-input" class="ranking-nickname-input" type="text" maxlength="20" placeholder="${t('ranking.nickname.placeholder')}" aria-label="${t('ranking.nickname.aria')}">
        <button id="ranking-submit-btn" class="panel-button secondary ranking-submit-btn" type="button">${t('ranking.submit')}</button>
      </div>
      <ol id="ranking-list" class="ranking-list"></ol>
    `;
    infiniteSelectPanel.appendChild(rankingPanel);

    function renderLanguageControl() {
      if (languageSelect) {
        languageSelect.value = language;
        for (const option of languageSelect.options) {
          option.textContent = t(`language.${option.value}`);
        }
      }
      if (languageLabel) languageLabel.textContent = t('language.label');
      if (languageDesc) languageDesc.textContent = t('language.desc');
    }

    function renderStaticCopy() {
      i18n?.applyToDocument?.();
      renderLanguageControl();
      stageBackBtn?.querySelector('.panel-button-title')?.replaceChildren(document.createTextNode(t('back.title')));
      stageBackBtn?.querySelector('.panel-button-desc')?.replaceChildren(document.createTextNode(t('back.desc')));
      stageSelectPanel.querySelector('.menu-panel-title').textContent = t('stageSelect.title');
      infiniteBackBtn?.querySelector('.panel-button-title')?.replaceChildren(document.createTextNode(t('back.title')));
      infiniteBackBtn?.querySelector('.panel-button-desc')?.replaceChildren(document.createTextNode(t('back.desc')));
      infiniteSelectPanel.querySelector('.menu-panel-title').textContent = t('infinite.title');
      infiniteNewBtn.querySelector('.panel-button-title').textContent = t('infinite.new.title');
      infiniteNewBtn.querySelector('.panel-button-desc').textContent = t('infinite.new.desc');
      infiniteContinueBtn.querySelector('.panel-button-title').textContent = t('infinite.continue.title');
      infiniteContinueBtn.querySelector('.panel-button-desc').textContent = t('infinite.continue.desc');
      infiniteAbandonBtn.textContent = t('infinite.abandon');
      rankingPanel.querySelector('.ranking-title').textContent = t('ranking.title');
      rankingNicknameInput?.setAttribute('placeholder', t('ranking.nickname.placeholder'));
      rankingNicknameInput?.setAttribute('aria-label', t('ranking.nickname.aria'));
      if (rankingSubmitBtn) rankingSubmitBtn.textContent = t('ranking.submit');
      stageClearPopup.querySelector('.stage-clear-kicker').textContent = t('stage.clear.kicker');
      stageClearPopup.querySelector('#stage-clear-title').textContent = t('stage.clear.title');
      stageClearPopup.querySelector('#stage-clear-desc').textContent = t('stage.clear.desc');
      stageClearPopup.querySelector('.stage-clear-reward-label').textContent = t('stage.clear.rewardLabel');
      if (stageClearRewardValue) stageClearRewardValue.textContent = t('stage.clear.reward', { reward: 5 });
      if (stageClearConfirmBtn) stageClearConfirmBtn.textContent = t('stage.clear.confirm');
      abandonWarningPopup.querySelector('.abandon-warning-kicker').textContent = t('abandon.kicker');
      abandonWarningPopup.querySelector('#abandon-warning-title').textContent = t('abandon.title');
      abandonWarningPopup.querySelector('#abandon-warning-desc').textContent = t('abandon.desc');
      if (abandonCancelBtn) abandonCancelBtn.textContent = t('cancel');
      if (abandonConfirmBtn) abandonConfirmBtn.textContent = t('abandon.confirm');
      setModeCardCopy();
      renderStageCards();
      renderThemeShop();
      setGridVisible(gridVisible, { persist: false });
      updateMenuState(storageReadSave());
      if (shopThemeStatus) shopThemeStatus.textContent = t('theme.choose');
    }

    if (menuContinueNote) {
      menuContinueNote.insertAdjacentElement('beforebegin', stageSelectPanel);
      menuContinueNote.insertAdjacentElement('beforebegin', infiniteSelectPanel);
    } else if (gamePanel) {
      gamePanel.append(stageSelectPanel, infiniteSelectPanel);
    }

    document.body.append(stageClearPopup, abandonWarningPopup);

    const stageBackBtn = stageSelectPanel.querySelector('#stage-back-btn');
    const stageGrid = stageSelectPanel.querySelector('#stage-grid');
    const infiniteBackBtn = infiniteSelectPanel.querySelector('#infinite-back-btn');
    const infiniteNewBtn = infiniteSelectPanel.querySelector('#infinite-new-btn');
    const infiniteContinueBtn = infiniteSelectPanel.querySelector('#infinite-continue-btn');
    const stageClearRewardValue = stageClearPopup.querySelector('#stage-clear-reward-value');
    const rankingMyStatus = rankingPanel.querySelector('#ranking-my-status');
    const rankingNicknameInput = rankingPanel.querySelector('#ranking-nickname-input');
    const rankingSubmitBtn = rankingPanel.querySelector('#ranking-submit-btn');
    const rankingList = rankingPanel.querySelector('#ranking-list');
    const stageClearConfirmBtn = stageClearPopup.querySelector('#stage-clear-confirm-btn');
    const abandonCancelBtn = abandonWarningPopup.querySelector('#abandon-cancel-btn');
    const abandonConfirmBtn = abandonWarningPopup.querySelector('#abandon-confirm-btn');

    let stageClearConfirmAction = null;
    let abandonConfirmAction = null;
    let rankingSyncTimer = null;
    let rankingUnsubscribe = null;

    let actions = {
      onStartStageMode: () => setStatus(t('status.selectStage')),
      onStartInfiniteMode: () => setStatus(t('status.selectInfinite')),
      onStartStage: () => setStatus(t('status.startStage')),
      onStartInfiniteNew: () => setStatus(t('status.startInfiniteNew')),
      onContinueInfinite: () => setStatus(t('status.continueInfinite')),
      onAbandonInfinite: () => setStatus(t('status.abandonInfinite')),
      onSetGridVisible: () => undefined,
      onQuit: () => setStatus(t('status.quitUnavailable')),
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

    function syncGuestCloudControls() {
      if (!guestCloudControls) return;
      const isGuest = Boolean(window.UpUpUpAuth?.isGuest?.());
      guestCloudControls.hidden = !isGuest;
    }

    function downloadTextFile(filename, text) {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    async function exportGuestProgress() {
      const auth = window.UpUpUpAuth;
      if (!auth?.isGuest?.()) {
        setStatus(t('status.guestOnly'));
        return;
      }
      guestExportBtn.disabled = true;
      try {
        const text = await auth.exportGuestData();
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadTextFile(`upupup-guest-save-${stamp}.json`, text);
        setStatus(t('status.exportDone'));
      } catch {
        setStatus(t('status.exportFailed'));
      } finally {
        guestExportBtn.disabled = false;
      }
    }

    async function importGuestProgress(file) {
      const auth = window.UpUpUpAuth;
      if (!auth?.isGuest?.()) {
        setStatus(t('status.guestOnly'));
        return;
      }
      if (!file) return;
      guestImportBtn.disabled = true;
      try {
        const text = await file.text();
        await auth.importGuestData(text);
        refreshAccountState();
        setStatus(t('status.importDone'));
      } catch {
        setStatus(t('status.importFailed'));
      } finally {
        guestImportBtn.disabled = false;
        if (guestImportFile) guestImportFile.value = '';
      }
    }

    function applyTheme(themeName) {
      currentTheme = ['default', 'light', 'dark'].includes(themeName) ? themeName : 'default';
      if (currentTheme === 'default') {
        delete document.body.dataset.theme;
        return;
      }
      document.body.dataset.theme = currentTheme;
    }

    const themeItems = [
      { id: 'default', titleKey: 'theme.default.title', featuresKey: 'theme.default.features' },
      { id: 'light', titleKey: 'theme.light.title', featuresKey: 'theme.light.features' },
      { id: 'dark', titleKey: 'theme.dark.title', featuresKey: 'theme.dark.features' },
    ];

    function persistThemeShop() {
      return writeThemeShop({ ownedThemes, currentTheme });
    }

    function renderThemeShop() {
      if (!shopThemeGrid) return;
      shopThemeGrid.innerHTML = themeItems.map((item) => {
        const active = currentTheme === item.id;
        const title = t(item.titleKey);
        const featureText = t(item.featuresKey);
        return `
          <button class="panel-button secondary" type="button" data-theme-id="${item.id}" aria-pressed="${active}">
            <span class="panel-button-title">${title}${active ? t('theme.activeSuffix') : ''}</span>
            <span class="panel-button-desc">${featureText}</span>
          </button>
        `;
      }).join('');
    }

    function buyOrApplyTheme(themeId) {
      const item = themeItems.find((entry) => entry.id === themeId);
      if (!item) return;

      ownedThemes = Array.from(new Set([...ownedThemes, item.id]));
      if (shopThemeStatus) shopThemeStatus.textContent = t('theme.applied', { title: t(item.titleKey) });

      applyTheme(item.id);
      persistThemeShop();
      renderThemeShop();
    }

    function hideStageClearPopup() {
      stageClearConfirmAction = null;
      stageClearPopup.hidden = true;
    }

    function hideAbandonWarningPopup() {
      abandonConfirmAction = null;
      abandonWarningPopup.hidden = true;
    }

    function showAbandonWarningPopup({ onConfirm = null } = {}) {
      abandonConfirmAction = typeof onConfirm === 'function' ? onConfirm : null;
      abandonWarningPopup.hidden = false;
    }

    function showStageClearPopup({ stage = 1, reward = 0, onConfirm = null } = {}) {
      stageClearConfirmAction = typeof onConfirm === 'function' ? onConfirm : null;
      const title = stageClearPopup.querySelector('#stage-clear-title');
      const desc = stageClearPopup.querySelector('#stage-clear-desc');

      if (title) {
        title.textContent = t('stage.clear.stageTitle', { stage: numberOr(stage, 1) });
      }
      if (desc) {
        desc.textContent = t('stage.clear.desc');
      }
      if (stageClearRewardValue) {
        stageClearRewardValue.textContent = t('stage.clear.reward', { reward: numberOr(reward, 0) });
      }

      stageClearPopup.hidden = false;
    }

    function setModeCardCopy() {
      if (menuPlayBtn) {
        menuPlayBtn.setAttribute('aria-label', t('menu.play.aria'));
      }
      if (menuContinueBtn) {
        menuContinueBtn.setAttribute('aria-label', t('menu.infinite.aria'));
      }

      const generalKicker = menuPlayBtn?.querySelector('.menu-tile-kicker');
      const generalTitle = menuPlayBtn?.querySelector('.menu-tile-title');
      const generalDesc = menuPlayBtn?.querySelector('.menu-tile-desc');
      const infiniteKicker = menuContinueBtn?.querySelector('.menu-tile-kicker');
      const infiniteTitle = menuContinueBtn?.querySelector('.menu-tile-title');
      const infiniteDesc = menuContinueBtn?.querySelector('.menu-tile-desc');

      if (generalKicker) generalKicker.textContent = t('menu.general.kicker');
      if (generalTitle) generalTitle.textContent = t('menu.general.title');
      if (generalDesc) {
        generalDesc.textContent = t('menu.general.desc');
      }

      if (infiniteKicker) infiniteKicker.textContent = t('menu.infinite.kicker');
      if (infiniteTitle) infiniteTitle.textContent = t('menu.infinite.title');
      if (infiniteDesc) {
        infiniteDesc.textContent = t('menu.infinite.desc');
      }
    }

    function renderStageCards() {
      if (!stageGrid) return;

      const unlockedLimit = getUnlockedStageLimit();
      stageGrid.innerHTML = '';

      for (let stageNumber = 1; stageNumber <= stageCount; stageNumber++) {
        const locked = stageNumber > unlockedLimit && !hasStageEditorStage(stageNumber);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stage-card';
        button.dataset.stageNumber = String(stageNumber);
        button.disabled = locked;
        if (locked) {
          button.classList.add('is-locked');
        }

        button.innerHTML = `
          <span class="stage-card-label">${t('stage.card.label')}</span>
          <span class="stage-card-number">${String(stageNumber).padStart(2, '0')}</span>
          <span class="stage-card-note">${locked ? t('stage.card.locked') : t('stage.card.playable')}</span>
        `;

        stageGrid.appendChild(button);
      }
    }


    function renderRanking(items, error = null) {
      if (!rankingList) return;
      if (!Array.isArray(items)) {
        const code = error?.code || '';
        if (code.includes('permission-denied')) {
          rankingList.innerHTML = `<li class="ranking-empty">${t('ranking.permissionDenied')}</li>`;
        } else if (code.includes('failed-precondition')) {
          rankingList.innerHTML = `<li class="ranking-empty">${t('ranking.indexRequired')}</li>`;
        } else {
          rankingList.innerHTML = `<li class="ranking-empty">${t('ranking.loadFailed')}</li>`;
        }
        return;
      }
      if (!items.length) {
        rankingList.innerHTML = `<li class="ranking-empty">${t('ranking.empty')}</li>`;
        return;
      }
      rankingList.innerHTML = items.map((item) => (`<li class="ranking-item"><span>#${item.rank} ${item.nickname}</span><strong>${item.score}</strong></li>`)).join('');
    }

    async function refreshRanking() {
      const auth = window.UpUpUpAuth;
      if (!rankingList || !auth?.getInfiniteRanking) return;
      rankingList.innerHTML = `<li class="ranking-empty">${t('ranking.loading')}</li>`;
      try {
        renderRanking(await auth.getInfiniteRanking(20));
      } catch (error) {
        if (window?.console?.error) console.error('[Ranking] getInfiniteRanking failed', error);
        renderRanking(null, error);
      }
    }

    function ensureRankingRealtimeSync() {
      const auth = window.UpUpUpAuth;
      if (!auth?.subscribeInfiniteRanking || rankingUnsubscribe) return;
      rankingUnsubscribe = auth.subscribeInfiniteRanking((items, error) => renderRanking(items, error), 20);
    }

    async function syncMyRankingState() {
      const auth = window.UpUpUpAuth;
      const user = auth?.getUser?.();
      if (!user) {
        const isGuest = Boolean(auth?.isGuest?.());
        if (rankingMyStatus) rankingMyStatus.textContent = isGuest
          ? t('ranking.guestReadonly')
          : t('ranking.guestStatus');
        if (rankingNicknameInput) rankingNicknameInput.disabled = true;
        if (rankingSubmitBtn) rankingSubmitBtn.disabled = true;
        if (menuLogoutBtn) menuLogoutBtn.hidden = true;
        return;
      }
      if (menuLogoutBtn) menuLogoutBtn.hidden = false;
      if (rankingNicknameInput) rankingNicknameInput.disabled = false;
      if (rankingSubmitBtn) rankingSubmitBtn.disabled = false;
      try {
        const mine = await auth.getMyInfiniteRanking();
        if (rankingNicknameInput) rankingNicknameInput.value = mine?.nickname || user.displayName || '';
        if (rankingMyStatus) rankingMyStatus.textContent = mine
          ? t('ranking.registered', { score: numberOr(mine.score, 0) })
          : t('ranking.notRegistered');
      } catch {
        if (rankingMyStatus) rankingMyStatus.textContent = t('ranking.myLoadFailed');
      }
    }

    function scheduleRankingAutoSync() {
      const auth = window.UpUpUpAuth;
      const user = auth?.getUser?.();
      if (!user) return;
      if (rankingSyncTimer) clearTimeout(rankingSyncTimer);
      rankingSyncTimer = setTimeout(async () => {
        const record = readInfiniteBestRecord();
        const nickname = rankingNicknameInput?.value?.trim() || user.displayName || t('name.anonymous');
        try {
          await auth.upsertInfiniteRanking({
            nickname,
            score: numberOr(record?.score, 0),
            elapsedMs: Number.isFinite(record?.elapsedMs) ? record.elapsedMs : null,
          });
          await refreshRanking();
          await syncMyRankingState();
        } catch {
          // ignore background sync failures
        }
      }, 1200);
    }

    function setGameView(view) {
      gameView = view === 'stages' || view === 'infinite' ? view : 'modes';
      const showModes = gameView === 'modes';
      const showStages = gameView === 'stages';
      const showInfinite = gameView === 'infinite';

      menuOverlay.classList.toggle('is-stage-view', showStages);
      menuOverlay.classList.toggle('is-infinite-view', showInfinite);

      if (gameTitle) {
        gameTitle.hidden = !showModes;
      }
      if (menuCreditBalance) {
        menuCreditBalance.hidden = !showModes;
      }
      if (menuActions) {
        menuActions.hidden = !showModes;
      }
      if (menuContinueNote) {
        menuContinueNote.hidden = !showModes;
      }
      if (stageSelectPanel) {
        if (showStages) {
          renderStageCards();
        }
        stageSelectPanel.hidden = !showStages;
      }
      if (infiniteSelectPanel) {
        infiniteSelectPanel.hidden = !showInfinite;
      }

      if (showInfinite && activeTab === 'game') {
        ensureRankingRealtimeSync();
        refreshRanking();
        syncMyRankingState();
      }
    }


    function setActiveSkinTab(tabName) {
      const nextTab = skinSubpanels.some((panel) => panel.dataset.skinPanel === tabName)
        ? tabName
        : 'skins';
      activeSkinTab = nextTab;

      for (const button of skinSubtabButtons) {
        button.setAttribute('aria-selected', String(button.dataset.skinTab === nextTab));
      }

      for (const panel of skinSubpanels) {
        const isActive = panel.dataset.skinPanel === nextTab;
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
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

      if (nextTab === 'game') {
        setGameView('modes');
      }

      if (nextTab === 'skin') {
        setActiveSkinTab(activeSkinTab);
      }

    }

    function setMenuVisible(visible) {
      menuVisible = Boolean(visible);
      menuOverlay.style.display = menuVisible ? 'flex' : 'none';
      if (editorAccessBtn) {
        editorAccessBtn.hidden = !menuVisible;
      }
      if (menuVisible) {
        setActiveTab(activeTab);
        setGameView(gameView);
      }
    }

    function setCreditBalance(balance) {
      creditBalance = numberOr(balance, 0);
      if (menuCreditBalance) {
        menuCreditBalance.textContent = t('credits.balance', { credits: creditBalance });
      }
      renderThemeShop();
    }

    function updateMenuState(saved) {
      const hasSave = Boolean(saved);
      const hasInfiniteSave = hasSave && saved?.mode === 'infinite';

      if (infiniteContinueBtn) {
        infiniteContinueBtn.disabled = !hasInfiniteSave;
      }
      if (infiniteAbandonBtn) {
        infiniteAbandonBtn.disabled = !hasInfiniteSave;
      }

      if (menuContinueNote) {
        menuContinueNote.textContent = hasSave
          ? t('menu.lastSave', { time: formatTime(saved.savedAt ?? Date.now()) })
          : '';
      }
    }

    function setGridVisible(visible, { persist = true } = {}) {
      gridVisible = Boolean(visible);
      if (gridToggleBtn) {
        gridToggleBtn.innerHTML = gridVisible
          ? `<span class="panel-button-title">${t('grid.on.title')}</span><span class="panel-button-desc">${t('grid.on.desc')}</span>`
          : `<span class="panel-button-title">${t('grid.off.title')}</span><span class="panel-button-desc">${t('grid.off.desc')}</span>`;
      }
      if (persist) {
        writePrefs({ autoSaveEnabled, gridVisible, audioVolume, language });
      }
    }

    function toggleGridVisible() {
      const nextVisible = !gridVisible;
      setGridVisible(nextVisible);
      actions.onSetGridVisible?.(nextVisible);
    }

    function setAutosaveEnabled(enabled) {
      autoSaveEnabled = Boolean(enabled);
      writePrefs({ autoSaveEnabled, gridVisible, audioVolume, language });
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
      writePrefs({ autoSaveEnabled, gridVisible, audioVolume, language });
      syncAudioVolumeUI();
      window.UpUpUpAudio?.getAudioManager?.()?.setVolume(audioVolume);
      actions.onSetAudioVolume(audioVolume);
    }

    function setLanguage(nextLanguage) {
      language = i18n?.setLanguage?.(nextLanguage) ?? 'ko';
      renderStaticCopy();
    }


    function bind() {
      renderStaticCopy();
      setGameView('modes');

      languageSelect?.addEventListener('change', () => {
        setLanguage(languageSelect.value);
      });

      shopThemeGrid?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const themeButton = target?.closest('[data-theme-id]');
        if (!themeButton || !shopThemeGrid.contains(themeButton)) return;
        buyOrApplyTheme(themeButton.dataset.themeId);
      });

      editorAccessBtn?.addEventListener('click', async () => {
        const auth = window.UpUpUpAuth;
        if (!auth?.requireEditorAccess) {
          window.alert(t('editor.moduleMissing'));
          return;
        }

        editorAccessBtn.disabled = true;
        editorAccessBtn.textContent = t('editor.checking');
        try {
          await auth.requireEditorAccess();
          window.location.href = './editor/';
        } catch (error) {
          const code = error?.code ?? '';
          if (code.includes('editor-permission-denied')) {
            window.alert(t('editor.denied'));
          } else {
            window.alert(t('editor.failed'));
          }
        } finally {
          editorAccessBtn.disabled = false;
          editorAccessBtn.textContent = t('editor.access');
        }
      });

      menuPlayBtn?.addEventListener('click', () => {
        const audio = window.UpUpUpAudio?.getAudioManager?.();
        audio?.unlock?.();
        audio?.playTabNext?.();
        setGameView('stages');
        actions.onStartStageMode?.();
      });

      menuContinueBtn?.addEventListener('click', () => {
        const audio = window.UpUpUpAudio?.getAudioManager?.();
        audio?.unlock?.();
        audio?.playTabNext?.();
        setGameView('infinite');
        actions.onStartInfiniteMode?.();
      });

      stageBackBtn?.addEventListener('click', () => {
        const audio = window.UpUpUpAudio?.getAudioManager?.();
        audio?.unlock?.();
        audio?.playTabPrev?.();
        setGameView('modes');
      });

      infiniteBackBtn?.addEventListener('click', () => {
        const audio = window.UpUpUpAudio?.getAudioManager?.();
        audio?.unlock?.();
        audio?.playTabPrev?.();
        setGameView('modes');
      });

      infiniteNewBtn?.addEventListener('click', () => {
        const audio = window.UpUpUpAudio?.getAudioManager?.();
        audio?.unlock?.();
        audio?.playStartSwoosh?.();
        actions.onStartInfiniteNew?.();
      });

      infiniteContinueBtn?.addEventListener('click', () => {
        if (infiniteContinueBtn.disabled) return;
        const audio = window.UpUpUpAudio?.getAudioManager?.();
        audio?.unlock?.();
        audio?.playStartSwoosh?.();
        actions.onContinueInfinite?.();
      });

      rankingSubmitBtn?.addEventListener('click', async () => {
        const auth = window.UpUpUpAuth;
        const user = auth?.getUser?.();
        if (!user) {
          setStatus(t('status.loginRequired'));
          return;
        }

        const record = readInfiniteBestRecord();
        const nickname = rankingNicknameInput?.value?.trim() || user.displayName || t('name.anonymous');
        if (rankingNicknameInput && !rankingNicknameInput.value.trim()) rankingNicknameInput.value = nickname;

        rankingSubmitBtn.disabled = true;
        try {
          await auth.upsertInfiniteRanking({
            nickname,
            score: numberOr(record?.score, 0),
            elapsedMs: Number.isFinite(record?.elapsedMs) ? record.elapsedMs : null,
          });
          setStatus(t('status.rankingSaved'));
          await syncMyRankingState();
          await refreshRanking();
        } catch {
          setStatus(t('status.rankingFailed'));
        } finally {
          rankingSubmitBtn.disabled = false;
        }
      });

      menuLogoutBtn?.addEventListener('click', async () => {
        const auth = window.UpUpUpAuth;
        try {
          await auth?.signOut?.();
          setStatus(t('status.logoutDone'));
          syncGuestCloudControls();
          await syncMyRankingState();
          await refreshRanking();
        } catch {
          setStatus(t('status.logoutFailed'));
        }
      });

      guestExportBtn?.addEventListener('click', exportGuestProgress);
      guestImportBtn?.addEventListener('click', () => guestImportFile?.click());
      guestImportFile?.addEventListener('change', () => importGuestProgress(guestImportFile.files?.[0]));

      window.addEventListener('upupup:infinite-best-record-updated', scheduleRankingAutoSync);
      window.addEventListener('upupup:language-changed', () => {
        language = i18n?.readLanguage?.() ?? language;
        renderStaticCopy();
      });
      window.addEventListener('upupup:user-data-cloud-applied', refreshAccountState);
      window.addEventListener('beforeunload', () => {
        if (rankingUnsubscribe) rankingUnsubscribe();
      });

      infiniteAbandonBtn?.addEventListener('click', () => {
        if (infiniteAbandonBtn.disabled) return;
        const audio = window.UpUpUpAudio?.getAudioManager?.();
        audio?.unlock?.();
        audio?.playTabPrev?.();
        showAbandonWarningPopup({
          onConfirm: () => actions.onAbandonInfinite?.(),
        });
      });

      stageGrid?.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-stage-number]');
        if (!button || button.disabled) return;
        const stageNumber = Number(button.dataset.stageNumber);
        actions.onStartStage?.(stageNumber);
      });

      for (const button of menuTabButtons) {
        button.addEventListener('click', () => {
          const nextTab = button.dataset.menuTab;
          if (nextTab !== activeTab) {
            const currentIndex = menuTabButtons.findIndex((tabButton) => tabButton.dataset.menuTab === activeTab);
            const nextIndex = menuTabButtons.findIndex((tabButton) => tabButton.dataset.menuTab === nextTab);
            const audio = window.UpUpUpAudio?.getAudioManager?.();
            audio?.unlock?.();
            if (nextIndex > currentIndex) {
              audio?.playTabNext?.();
            } else if (nextIndex < currentIndex) {
              audio?.playTabPrev?.();
            }
          }
          setActiveTab(nextTab);
        });
      }

      for (const button of skinSubtabButtons) {
        button.addEventListener('click', () => {
          setActiveSkinTab(button.dataset.skinTab);
        });
      }

      gridToggleBtn?.addEventListener('click', () => {
        toggleGridVisible();
      });

      if (audioVolumeSlider) {
        audioVolumeSlider.addEventListener('input', (event) => {
          setAudioVolume(Number(event.target.value) / 100);
        });
      }

      stageClearConfirmBtn?.addEventListener('click', () => {
        const callback = stageClearConfirmAction;
        hideStageClearPopup();
        callback?.();
      });

      abandonCancelBtn?.addEventListener('click', () => {
        hideAbandonWarningPopup();
      });

      abandonConfirmBtn?.addEventListener('click', () => {
        const callback = abandonConfirmAction;
        hideAbandonWarningPopup();
        callback?.();
      });
    }

    bind();
    setActiveSkinTab(activeSkinTab);
    setActiveTab(activeTab);
    applyTheme(currentTheme);

    function refreshAccountState() {
      const savedState = storageReadSave();
      updateMenuState(savedState);
      setCreditBalance(savedState?.credits ?? window.UpUpUpShared.readCreditBalance?.() ?? 0);
      const nextPrefs = readPrefs();
      i18n?.reloadLanguage?.();
      language = i18n?.readLanguage?.() ?? language;
      ownedThemes = Array.isArray(nextPrefs.ownedThemes) ? nextPrefs.ownedThemes : ['default'];
      currentTheme = typeof nextPrefs.currentTheme === 'string' ? nextPrefs.currentTheme : 'default';
      applyTheme(currentTheme);
      renderStaticCopy();
      syncGuestCloudControls();
      syncMyRankingState();
    }

    const savedState = storageReadSave();
    updateMenuState(savedState);
    setCreditBalance(savedState?.credits ?? window.UpUpUpShared.readCreditBalance?.() ?? 0);
    setGridVisible(gridVisible, { persist: false });
    setAutosaveEnabled(autoSaveEnabled);
    syncAudioVolumeUI();
    renderThemeShop();
    syncGuestCloudControls();

    return {
      getPreferences() {
        return { autoSaveEnabled, gridVisible, audioVolume, language, currentTheme, ownedThemes: [...ownedThemes] };
      },
      setActions,
      setStatus,
      setMenuVisible,
      setCreditBalance,
      updateMenuState,
      setGridVisible,
      toggleGridVisible,
      setAutosaveEnabled,
      setAudioVolume,
      setActiveTab,
      setGameView,
      showStageClearPopup,
      hideStageClearPopup,
      showAbandonWarningPopup,
      hideAbandonWarningPopup,
      refreshAccountState,
    };
  }

  window.UpUpUpUI = { createUIController };
})();
