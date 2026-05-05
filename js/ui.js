(() => {
  const {
    formatTime,
    formatDuration,
    numberOr,
    readPrefs,
    readInfiniteBestRecord,
    writePrefs,
    writeThemeShop,
    storageReadSave,
    storageWriteSave,
    storageListSaves,
    hasStageEditorStage,
    getUnlockedStageLimit,
    writeCreditBalance,
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
    const saveSlotControls = document.getElementById('save-slot-controls');
    const menuLogoutBtn = document.getElementById('menu-logout-btn');
    const saveStatus = document.getElementById('save-status');
    const shopThemeGrid = document.getElementById('shop-theme-grid');
    const shopThemeStatus = document.getElementById('shop-theme-status');
    const gameTitle = gamePanel?.querySelector('.menu-title');
    const menuActions = gamePanel?.querySelector('.menu-actions');
    const bestScoreHud = (() => {
      let hud = document.getElementById('best-score-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'best-score-hud';
        hud.className = 'best-score-hud';
        hud.hidden = true;
        hud.setAttribute('aria-live', 'polite');
        document.body.appendChild(hud);
      }
      return hud;
    })();

    const stageClearPopup = document.createElement('div');
    stageClearPopup.className = 'stage-clear-popup';
    stageClearPopup.hidden = true;
    stageClearPopup.innerHTML = `
      <div class="stage-clear-panel" role="dialog" aria-modal="true" aria-labelledby="stage-clear-title" aria-describedby="stage-clear-desc">
        <span class="stage-clear-kicker">CLEAR</span>
        <h2 id="stage-clear-title" class="stage-clear-title">스테이지 클리어</h2>
        <p id="stage-clear-desc" class="stage-clear-desc">별을 모두 모아 스테이지를 완료했습니다.</p>
        <div class="stage-clear-reward" aria-live="polite">
          <span class="stage-clear-reward-label">보상</span>
          <span id="stage-clear-reward-value" class="stage-clear-reward-value">+5 크레딧</span>
        </div>
        <button id="stage-clear-confirm-btn" class="panel-button secondary stage-clear-confirm-btn" type="button">메뉴로 돌아가기</button>
      </div>
    `;

    const abandonWarningPopup = document.createElement('div');
    abandonWarningPopup.className = 'abandon-warning-popup';
    abandonWarningPopup.hidden = true;
    abandonWarningPopup.innerHTML = `
      <div class="abandon-warning-panel" role="dialog" aria-modal="true" aria-labelledby="abandon-warning-title" aria-describedby="abandon-warning-desc">
        <span class="abandon-warning-kicker">주의</span>
        <h2 id="abandon-warning-title" class="abandon-warning-title">무한 모드를 중단할까요?</h2>
        <p id="abandon-warning-desc" class="abandon-warning-desc">진행 중인 무한 모드 저장이 삭제됩니다.</p>
        <div class="abandon-warning-actions">
          <button id="abandon-cancel-btn" class="panel-button secondary abandon-cancel-btn" type="button">취소</button>
          <button id="abandon-confirm-btn" class="panel-button secondary abandon-confirm-btn" type="button">중도 포기</button>
        </div>
      </div>
    `;

    const prefs = readPrefs();
    let autoSaveEnabled = prefs.autoSaveEnabled;
    let gridVisible = prefs.gridVisible;
    let audioVolume = prefs.audioVolume;
    let ownedThemes = Array.isArray(prefs.ownedThemes) ? prefs.ownedThemes : ['default'];
    let currentTheme = typeof prefs.currentTheme === 'string' ? prefs.currentTheme : 'default';
    let creditBalance = 0;
    let activeTab = 'game';
    let gameView = 'modes';
    let infiniteBestRecord = readInfiniteBestRecord();

    const stageCount = 50;

    const stageSelectPanel = document.createElement('div');
    stageSelectPanel.id = 'stage-select-panel';
    stageSelectPanel.className = 'mode-select-panel stage-select-panel';
    stageSelectPanel.hidden = true;
    stageSelectPanel.innerHTML = `
      <div class="mode-select-head stage-select-head">
        <button id="stage-back-btn" class="panel-button secondary stage-back-btn" type="button">
          <span class="panel-button-title">뒤로</span>
          <span class="panel-button-desc">메인 화면으로 돌아갑니다.</span>
        </button>
        <div class="mode-select-copy stage-select-copy">
          <h3 class="menu-panel-title">스테이지 선택</h3>
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
          <span class="panel-button-title">뒤로</span>
          <span class="panel-button-desc">메인 화면으로 돌아갑니다.</span>
        </button>
        <div class="mode-select-copy infinite-select-copy">
          <h3 class="menu-panel-title">무한 모드</h3>
        </div>
      </div>
      <div class="infinite-action-row">
        <button id="infinite-new-btn" class="panel-button secondary" type="button">
          <span class="panel-button-title">새 게임</span>
          <span class="panel-button-desc">무한 모드를 처음부터 새로 시작합니다.</span>
        </button>
        <button id="infinite-continue-btn" class="panel-button secondary" type="button">
          <span class="panel-button-title">이어하기</span>
          <span class="panel-button-desc">마지막 무한 모드 저장에서 계속합니다.</span>
        </button>
      </div>
    `;

    const infiniteAbandonBtn = document.createElement('button');
    infiniteAbandonBtn.id = 'infinite-abandon-btn';
    infiniteAbandonBtn.type = 'button';
    infiniteAbandonBtn.className = 'infinite-abandon-btn';
    infiniteAbandonBtn.textContent = '[중도 포기]';
    infiniteSelectPanel.appendChild(infiniteAbandonBtn);

    const rankingPanel = document.createElement('div');
    rankingPanel.className = 'infinite-ranking-panel';
    rankingPanel.innerHTML = `
      <div class="ranking-head">
        <h4 class="ranking-title">랭킹</h4>
        <p id="ranking-my-status" class="ranking-my-status">로그인 후 기록을 등록할 수 있습니다.</p>
      </div>
      <div class="ranking-nickname-row">
        <input id="ranking-nickname-input" class="ranking-nickname-input" type="text" maxlength="20" placeholder="닉네임 입력" aria-label="닉네임">
        <button id="ranking-submit-btn" class="panel-button secondary ranking-submit-btn" type="button">내 기록 등록/갱신</button>
      </div>
      <ol id="ranking-list" class="ranking-list"></ol>
    `;
    infiniteSelectPanel.appendChild(rankingPanel);

    function renderInfiniteBestHud() {
      const record = infiniteBestRecord ?? readInfiniteBestRecord();
      const score = numberOr(record?.score, 0);
      const elapsedText = formatDuration(record?.elapsedMs);
      bestScoreHud.textContent = `최고 점수: ${score}\n기록 시간: ${elapsedText}`;
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
      onStartStageMode: () => setStatus('스테이지를 선택하세요.'),
      onStartInfiniteMode: () => setStatus('무한 모드를 선택하세요.'),
      onStartStage: () => setStatus('스테이지를 시작합니다.'),
      onStartInfiniteNew: () => setStatus('새 무한 게임을 시작합니다.'),
      onContinueInfinite: () => setStatus('무한 모드 저장을 불러옵니다.'),
      onAbandonInfinite: () => setStatus('무한 모드를 중단합니다.'),
      onSetGridVisible: () => undefined,
      onQuit: () => setStatus('게임 종료는 아직 준비되지 않았습니다.'),
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

    async function manualSaveToSlot(slot) {
      const current = storageReadSave();
      if (!current) return setStatus(`저장할 진행이 없습니다. (슬롯 ${slot})`);
      const ok = await storageWriteSave(current, slot);
      setStatus(ok ? `슬롯 ${slot}에 저장했습니다.` : `슬롯 ${slot} 저장에 실패했습니다.`);
      renderSaveSlots();
    }

    function loadFromSlot(slot) {
      const save = storageReadSave(slot);
      if (!save) return setStatus(`슬롯 ${slot}에 저장된 진행이 없습니다.`);
      const restored = storageReadSave();
      if (!restored || restored.savedAt !== save.savedAt) {
        storageWriteSave(save, 1).then(() => {
          updateMenuState(save);
          setCreditBalance(save?.credits);
          setStatus(`슬롯 ${slot} 불러오기 완료.`);
        });
      }
    }

    function renderSaveSlots() {
      if (!saveSlotControls) return;
      const slots = storageListSaves?.() ?? [];
      saveSlotControls.innerHTML = slots.map(({ slot, save }) => `
        <div class="save-slot-row">
          <span class="panel-button-title">세이브 슬롯 ${slot}</span>
          <span class="panel-button-desc">${save ? `${formatTime(save.savedAt ?? Date.now())} | 점수 ${numberOr(save.score, 0)}` : '비어 있음'}</span>
          <div class="save-slot-actions">
            <button class="panel-button secondary" type="button" data-save-slot="${slot}" data-save-action="save">저장</button>
            <button class="panel-button secondary" type="button" data-save-slot="${slot}" data-save-action="load" ${save ? '' : 'disabled'}>불러오기</button>
          </div>
        </div>`).join('');
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
      { id: 'default', title: '기본 황색 테마', price: 0, desc: 'UPUPUP.io의 기본 황색 UI 테마입니다.' },
      { id: 'light', title: '라이트 테마', price: 10, desc: '일반 웹사이트처럼 흰색 바탕의 UI 테마입니다.' },
      { id: 'dark', title: '다크 테마', price: 25, desc: '눈부심을 줄인 어두운 UI 테마입니다.' },
    ];

    function persistThemeShop() {
      return writeThemeShop({ ownedThemes, currentTheme });
    }

    function renderThemeShop() {
      if (!shopThemeGrid) return;
      shopThemeGrid.innerHTML = themeItems.map((item) => {
        const owned = ownedThemes.includes(item.id);
        const active = currentTheme === item.id;
        return `
          <button class="panel-button secondary" type="button" data-theme-id="${item.id}" aria-pressed="${active}">
            <span class="panel-button-title">${item.title}${active ? ' (적용 중)' : ''}</span>
            <span class="panel-button-desc">${item.desc} · ${owned ? '보유' : `${item.price} 크레딧`}</span>
          </button>
        `;
      }).join('');
    }

    function buyOrApplyTheme(themeId) {
      const item = themeItems.find((entry) => entry.id === themeId);
      if (!item) return;

      if (!ownedThemes.includes(item.id)) {
        if (creditBalance < item.price) {
          if (shopThemeStatus) shopThemeStatus.textContent = `크레딧이 부족합니다. (${item.price} 필요)`;
          return;
        }
        creditBalance -= item.price;
        ownedThemes = Array.from(new Set([...ownedThemes, item.id]));
        writeCreditBalance(creditBalance);
        setCreditBalance(creditBalance);
        if (shopThemeStatus) shopThemeStatus.textContent = `${item.title} 구매 완료!`;
      } else if (shopThemeStatus) {
        shopThemeStatus.textContent = `${item.title} 적용 완료!`;
      }

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
        title.textContent = `스테이지 ${numberOr(stage, 1)} 클리어`;
      }
      if (desc) {
        desc.textContent = '별 3개를 모두 모아 스테이지를 완료했습니다.';
      }
      if (stageClearRewardValue) {
        stageClearRewardValue.textContent = `+${numberOr(reward, 0)} 크레딧`;
      }

      stageClearPopup.hidden = false;
    }

    function setModeCardCopy() {
      if (menuPlayBtn) {
        menuPlayBtn.setAttribute('aria-label', '일반 모드 선택');
      }
      if (menuContinueBtn) {
        menuContinueBtn.setAttribute('aria-label', '무한 모드 선택');
      }

      const generalKicker = menuPlayBtn?.querySelector('.menu-tile-kicker');
      const generalTitle = menuPlayBtn?.querySelector('.menu-tile-title');
      const generalDesc = menuPlayBtn?.querySelector('.menu-tile-desc');
      const infiniteKicker = menuContinueBtn?.querySelector('.menu-tile-kicker');
      const infiniteTitle = menuContinueBtn?.querySelector('.menu-tile-title');
      const infiniteDesc = menuContinueBtn?.querySelector('.menu-tile-desc');

      if (generalKicker) generalKicker.textContent = '일반';
      if (generalTitle) generalTitle.textContent = '일반';
      if (generalDesc) {
        generalDesc.textContent = '스테이지를 하나 선택해 바로 시작합니다.';
      }

      if (infiniteKicker) infiniteKicker.textContent = '무한';
      if (infiniteTitle) infiniteTitle.textContent = '무한';
      if (infiniteDesc) {
        infiniteDesc.textContent = '새 게임을 만들거나 저장된 진행에서 이어서 시작합니다.';
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
          <span class="stage-card-label">스테이지</span>
          <span class="stage-card-number">${String(stageNumber).padStart(2, '0')}</span>
          <span class="stage-card-note">${locked ? '잠김' : '플레이 가능'}</span>
        `;

        stageGrid.appendChild(button);
      }
    }


    function renderRanking(items, error = null) {
      if (!rankingList) return;
      if (!Array.isArray(items)) {
        const code = error?.code || '';
        if (code.includes('permission-denied')) {
          rankingList.innerHTML = '<li class="ranking-empty">랭킹 권한이 없어 불러올 수 없습니다. Firestore 규칙을 확인하세요.</li>';
        } else if (code.includes('failed-precondition')) {
          rankingList.innerHTML = '<li class="ranking-empty">랭킹 인덱스 설정이 필요합니다. 콘솔 링크를 확인하세요.</li>';
        } else {
          rankingList.innerHTML = '<li class="ranking-empty">랭킹을 불러오지 못했습니다.</li>';
        }
        return;
      }
      if (!items.length) {
        rankingList.innerHTML = '<li class="ranking-empty">아직 등록된 기록이 없습니다.</li>';
        return;
      }
      rankingList.innerHTML = items.map((item) => (`<li class="ranking-item"><span>#${item.rank} ${item.nickname}</span><strong>${item.score}</strong></li>`)).join('');
    }

    async function refreshRanking() {
      const auth = window.UpUpUpAuth;
      if (!rankingList || !auth?.getInfiniteRanking) return;
      rankingList.innerHTML = '<li class="ranking-empty">불러오는 중...</li>';
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
        if (rankingMyStatus) rankingMyStatus.textContent = '로그인 후 기록을 등록할 수 있습니다.';
        if (rankingLogoutBtn) rankingLogoutBtn.hidden = true;
        return;
      }
      if (rankingLogoutBtn) rankingLogoutBtn.hidden = false;
      try {
        const mine = await auth.getMyInfiniteRanking();
        if (rankingNicknameInput) rankingNicknameInput.value = mine?.nickname || user.displayName || '';
        if (rankingMyStatus) rankingMyStatus.textContent = mine
          ? `이미 등록됨 · 최고 ${numberOr(mine.score, 0)}점 (닉네임 변경 가능)`
          : '아직 등록 전 · 처음 등록 후에는 갱신만 가능합니다.';
      } catch {
        if (rankingMyStatus) rankingMyStatus.textContent = '내 랭킹 상태를 불러오지 못했습니다.';
      }
    }

    function scheduleRankingAutoSync() {
      const auth = window.UpUpUpAuth;
      const user = auth?.getUser?.();
      if (!user) return;
      if (rankingSyncTimer) clearTimeout(rankingSyncTimer);
      rankingSyncTimer = setTimeout(async () => {
        const record = readInfiniteBestRecord();
        const nickname = rankingNicknameInput?.value?.trim() || user.displayName || '익명';
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

      if (showInfinite) {
        ensureRankingRealtimeSync();
        refreshRanking();
        syncMyRankingState();
        infiniteBestRecord = readInfiniteBestRecord();
        renderInfiniteBestHud();
        bestScoreHud.classList.remove('is-game-hud');
        bestScoreHud.classList.add('is-menu-hud');
        bestScoreHud.hidden = false;
      } else {
        bestScoreHud.classList.remove('is-menu-hud', 'is-game-hud');
        bestScoreHud.hidden = true;
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
    }

    function setMenuVisible(visible) {
      menuOverlay.style.display = visible ? 'flex' : 'none';
      if (editorAccessBtn) {
        editorAccessBtn.hidden = !visible;
      }
      if (visible) {
        setActiveTab(activeTab);
        setGameView(gameView);
      }
    }

    function setCreditBalance(balance) {
      creditBalance = numberOr(balance, 0);
      if (menuCreditBalance) {
        menuCreditBalance.textContent = `보유 크레딧 ${creditBalance}`;
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
          ? `마지막 저장 ${formatTime(saved.savedAt ?? Date.now())} | ${saved?.mode === 'stage'
            ? `일반 ${numberOr(saved.stage, 1)}단계`
            : '무한 모드'} | 점수 ${numberOr(saved.score, 0)}`
          : '일반은 스테이지 선택, 무한은 새 게임 또는 이어하기를 사용합니다.';
      }
    }

    function setGridVisible(visible) {
      gridVisible = Boolean(visible);
      if (gridToggleBtn) {
        gridToggleBtn.innerHTML = gridVisible
          ? '<span class="panel-button-title">격자 끄기</span><span class="panel-button-desc">맵의 격자선을 숨깁니다.</span>'
          : '<span class="panel-button-title">격자 켜기</span><span class="panel-button-desc">맵의 격자선을 표시합니다.</span>';
      }
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
      setModeCardCopy();
      renderStageCards();
      setGameView('modes');

      shopThemeGrid?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const themeButton = target?.closest('[data-theme-id]');
        if (!themeButton || !shopThemeGrid.contains(themeButton)) return;
        buyOrApplyTheme(themeButton.dataset.themeId);
      });

      editorAccessBtn?.addEventListener('click', async () => {
        const auth = window.UpUpUpAuth;
        if (!auth?.requireEditorAccess) {
          window.alert('에디터 권한 확인 모듈을 찾을 수 없습니다.');
          return;
        }

        editorAccessBtn.disabled = true;
        editorAccessBtn.textContent = '[권한 확인 중]';
        try {
          await auth.requireEditorAccess();
          window.location.href = './editor/';
        } catch (error) {
          const code = error?.code ?? '';
          if (code.includes('editor-permission-denied')) {
            window.alert('스테이지 에디터 권한이 없는 계정입니다. 관리자에게 권한을 요청하세요.');
          } else {
            window.alert('에디터 권한 확인에 실패했습니다. 다시 시도해 주세요.');
          }
        } finally {
          editorAccessBtn.disabled = false;
          editorAccessBtn.textContent = '[에디터 접근]';
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
          setStatus('로그인이 필요합니다.');
          return;
        }

        const record = readInfiniteBestRecord();
        const nickname = rankingNicknameInput?.value?.trim() || user.displayName || '익명';
        if (rankingNicknameInput && !rankingNicknameInput.value.trim()) rankingNicknameInput.value = nickname;

        rankingSubmitBtn.disabled = true;
        try {
          await auth.upsertInfiniteRanking({
            nickname,
            score: numberOr(record?.score, 0),
            elapsedMs: Number.isFinite(record?.elapsedMs) ? record.elapsedMs : null,
          });
          setStatus('랭킹 기록을 등록/갱신했습니다.');
          await syncMyRankingState();
          await refreshRanking();
        } catch {
          setStatus('랭킹 등록에 실패했습니다.');
        } finally {
          rankingSubmitBtn.disabled = false;
        }
      });

      menuLogoutBtn?.addEventListener('click', async () => {
        const auth = window.UpUpUpAuth;
        try {
          await auth?.signOut?.();
          setStatus('로그아웃되었습니다.');
          await syncMyRankingState();
          await refreshRanking();
        } catch {
          setStatus('로그아웃에 실패했습니다.');
        }
      });

      saveSlotControls?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-save-slot]');
        if (!btn) return;
        const slot = Number(btn.dataset.saveSlot);
        const action = btn.dataset.saveAction;
        if (action === 'save') manualSaveToSlot(slot);
        if (action === 'load') loadFromSlot(slot);
      });
      window.addEventListener('upupup:infinite-best-record-updated', scheduleRankingAutoSync);
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
    setActiveTab(activeTab);
    applyTheme(currentTheme);

    const savedState = storageReadSave();
    updateMenuState(savedState);
    setCreditBalance(savedState?.credits);
    setGridVisible(gridVisible);
    setAutosaveEnabled(autoSaveEnabled);
    syncAudioVolumeUI();
    renderThemeShop();
    renderSaveSlots();

    return {
      getPreferences() {
        return { autoSaveEnabled, gridVisible, audioVolume, currentTheme, ownedThemes: [...ownedThemes] };
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
    };
  }

  window.UpUpUpUI = { createUIController };
})();
