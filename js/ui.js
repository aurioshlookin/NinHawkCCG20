// ============================================================
// ui.js — Interface: tabs, menu mobile, sons, confetti
// NÃO usa Firebase — pode ser carregado como script normal
// ============================================================
    window.authMode = 'login';
    window.currentAlbumSort = 'tier-desc';
    window.currentAlbumView = 'grid';
    window.adminCardState = { transX: 0, transY: 0 }; 
    window.allPlayersCache = []; 
    window.currentFilteredPlayers = [];
    window.currentExplorePage = 1;
    window.explorePlayersPerPage = 10;
    window.showOnlyOwned = true;
    window.currentViewedPlayerInventory = null;
    window.lastSyncDataStr = "";

    // Regras de Fusão
    const FUSION_RULES = {
      'C': { cost: 5, next: 'B', color: 'border-blue-400', textColor: 'text-blue-400' },
      'B': { cost: 5, next: 'A', color: 'border-purple-400', textColor: 'text-purple-400' },
      'A': { cost: 4, next: 'S', color: 'border-yellow-400', textColor: 'text-yellow-400' },
      'S': { cost: 3, next: 'SS', color: 'border-red-500', textColor: 'text-red-500' }
    };

    // Stubs para serem sobrescritos
    window.syncLeaderboard = () => {};
    window.loadAllPlayers = async () => {};

    window.getTradePeriod = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getHours() >= 18 ? '18' : '00'}`;
    };
    
    // --- FUNÇÕES DO MENU MOBILE ---
    window.toggleMobileMenu = () => {
      const nav = document.getElementById('main-nav');
      if (nav) {
        nav.classList.toggle('hidden');
        nav.classList.toggle('flex');
      }
    };

    window.closeMobileMenu = () => {
      const nav = document.getElementById('main-nav');
      if (nav && window.innerWidth < 768) {
        nav.classList.add('hidden');
        nav.classList.remove('flex');
      }
    };

    window.showModal = () => {
      // Discord Auth: o modal agora só exibe o botão Discord
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.remove('hidden');
    };

    window.closeModal = () => {
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.add('hidden');
    };

    window.showMessage = (msg, isConfirm = false, onConfirm = null) => {
      const msgModalText = document.getElementById('msg-modal-text');
      const modal = document.getElementById('msg-modal');
      const btnCancel = document.getElementById('msg-modal-cancel');
      const btnOk = document.getElementById('msg-modal-ok');
      
      if (msgModalText) msgModalText.innerText = msg;
      if (modal) modal.classList.remove('hidden');
      
      if (isConfirm) {
        if (btnCancel) btnCancel.classList.remove('hidden');
        if (btnOk) btnOk.onclick = () => { if(modal) modal.classList.add('hidden'); if(onConfirm) onConfirm(); };
        if (btnCancel) btnCancel.onclick = () => { if(modal) modal.classList.add('hidden'); };
      } else {
        if (btnCancel) btnCancel.classList.add('hidden');
        if (btnOk) btnOk.onclick = () => { if(modal) modal.classList.add('hidden'); };
      }
    };

    window.toggleShowOwned = (isChecked) => {
      window.showOnlyOwned = isChecked;
      const chkAlbum = document.getElementById('toggle-owned-album');
      const chkExplore = document.getElementById('toggle-owned-explore');
      if(chkAlbum) chkAlbum.checked = isChecked;
      if(chkExplore) chkExplore.checked = isChecked;
      if (!document.getElementById('section-album').classList.contains('hidden')) {
        window.refreshAlbum();
      } else if (!document.getElementById('section-explore').classList.contains('hidden')) {
        if (window.currentViewedPlayerInventory) {
          window.renderAlbumHTML('explore-grid', window.currentViewedPlayerInventory);
        }
      }
    };

    window.switchTab = async (tabName) => {
      window.closeMobileMenu(); // Fecha o menu no celular ao clicar
      
      ['gacha', 'album', 'explore', 'trade', 'admin', 'achievements', 'rarity', 'fusion'].forEach(t => {
        const sec = document.getElementById(`section-${t}`);
        const btn = document.getElementById(`tab-${t}`);
        if(!btn || !sec) return;

        if (t === tabName) {
          sec.classList.remove('hidden'); sec.classList.add('flex');
          btn.classList.remove('tab-inactive', 'text-yellow-600', 'text-green-500', 'text-red-600', 'text-blue-400', 'text-purple-400', 'text-fuchsia-400', 'border-transparent');
          btn.classList.add('tab-active');
          if(t === 'explore') btn.classList.add('text-yellow-500', 'border-yellow-500');
          if(t === 'trade') btn.classList.add('text-green-500', 'border-green-500');
          if(t === 'admin') btn.classList.add('text-red-500', 'border-red-500');
          if(t === 'achievements') btn.classList.add('text-blue-400', 'border-blue-400');
          if(t === 'rarity') btn.classList.add('text-purple-400', 'border-purple-400');
          if(t === 'fusion') btn.classList.add('text-fuchsia-400', 'border-fuchsia-400');

          if (t === 'explore') {
            if (window.loadGlobalStats) window.loadGlobalStats(); 
            if (window.loadAllPlayers) window.loadAllPlayers(false);
          }
          if (t === 'trade') {
            if (window.loadTradesBoard) window.loadTradesBoard();
          }
          if (t === 'fusion') {
            if (window.updateFusionOptions) window.updateFusionOptions();
          }
          if (t === 'admin') {
            if (window.loadGitHubImages) { window.loadGitHubImages(); window.updateAdminPreview(); }
            if (window.loadAdminPlayersLog) window.loadAdminPlayersLog();
          }
          if (t === 'achievements' && window.renderAchievements) window.renderAchievements();
        } else {
          sec.classList.add('hidden'); sec.classList.remove('flex');
          btn.classList.remove('tab-active', 'text-yellow-500', 'border-yellow-500', 'text-green-500', 'border-green-500', 'text-red-500', 'border-red-500', 'text-blue-400', 'border-blue-400', 'text-purple-400', 'border-purple-400', 'text-fuchsia-400', 'border-fuchsia-400');
          btn.classList.add('tab-inactive', 'border-transparent');
          if(t === 'explore') btn.classList.add('text-yellow-600');
          if(t === 'trade') btn.classList.add('text-green-500');
          if(t === 'admin') btn.classList.add('text-red-600');
          if(t === 'achievements') btn.classList.add('text-blue-400');
          if(t === 'rarity') btn.classList.add('text-purple-400');
          if(t === 'fusion') btn.classList.add('text-fuchsia-400');
        }
      });

      if (tabName === 'rarity') {
        const rarityLoading = document.getElementById('rarity-loading');
        const rarityGrid = document.getElementById('rarity-grid');
        if (!window.allPlayersCache || window.allPlayersCache.length === 0) {
          if (rarityLoading) rarityLoading.classList.remove('hidden');
          if (rarityGrid) rarityGrid.classList.add('hidden');
          await window.loadAllPlayers(false, true);
        }
        if (rarityLoading) rarityLoading.classList.add('hidden');
        if (rarityGrid) rarityGrid.classList.remove('hidden');
        if (window.renderRarityBoard) window.renderRarityBoard();
      }
    };

    window.refreshRarity = async () => {
      const rarityLoading = document.getElementById('rarity-loading');
      const rarityGrid = document.getElementById('rarity-grid');
      if (rarityLoading) rarityLoading.classList.remove('hidden');
      if (rarityGrid) rarityGrid.classList.add('hidden');
      await window.loadAllPlayers(true, true);
      if (rarityLoading) rarityLoading.classList.add('hidden');
      if (rarityGrid) rarityGrid.classList.remove('hidden');
      if (window.renderRarityBoard) window.renderRarityBoard();
    };

    window.setAlbumViewMode = (mode) => {
      window.currentAlbumView = mode;
      ['grid', 'table', 'ranked'].forEach(m => {
        const btn = document.getElementById(`btn-view-${m}`);
        if(btn) {
          if (m === mode) {
            btn.classList.add('bg-green-600', 'text-white');
            btn.classList.remove('text-gray-400', 'hover:bg-gray-700', 'hover:text-white', 'bg-gray-600');
          } else {
            btn.classList.remove('bg-green-600', 'text-white', 'bg-gray-600');
            btn.classList.add('text-gray-400', 'hover:bg-gray-700', 'hover:text-white');
          }
        }
      });
      if(window.refreshAlbum) window.refreshAlbum();
    };

    window.updateAlbumViewSettings = () => {
      const sortSelect = document.getElementById('album-sort');
      if (sortSelect) {
        window.currentAlbumSort = sortSelect.value;
        if(window.refreshAlbum) window.refreshAlbum();
      }
    };

    document.addEventListener('click', (e) => {
      const drop = document.getElementById('notif-dropdown');
      const btn = document.getElementById('btn-notifications');
      if(drop && !drop.classList.contains('hidden') && !drop.contains(e.target) && !btn.contains(e.target)) {
        drop.classList.add('hidden');
        drop.classList.remove('flex');
      }
    });

    let isDraggingPreview = false;
    let dragStartX, dragStartY;

    const handleDragStart = (e) => {
      const container = document.getElementById('admin-preview-container');
      if(container && container.parentElement && container.parentElement.contains(e.target)) {
        isDraggingPreview = true;
        dragStartX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        dragStartY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        if(e.type === 'mousedown') e.preventDefault();
      }
    };

    const handleDragMove = (e) => {
      if(!isDraggingPreview) return;
      if(e.type === 'touchmove') e.preventDefault();
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const dx = clientX - dragStartX;
      const dy = clientY - dragStartY;
      const zoomEl = document.getElementById('admin-zoom');
      const currentZoom = (zoomEl && parseFloat(zoomEl.value)) ? parseFloat(zoomEl.value) : 1;
      
      window.adminCardState.transX += dx / currentZoom; 
      window.adminCardState.transY += dy / currentZoom;
      dragStartX = clientX;
      dragStartY = clientY;
      
      if(window.updateAdminPreview) window.updateAdminPreview();
    };

    const handleDragEnd = () => { isDraggingPreview = false; };

    document.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchstart', handleDragStart, {passive: false});
    document.addEventListener('touchmove', handleDragMove, {passive: false});
    document.addEventListener('touchend', handleDragEnd);

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    window.playGachaSound = (tier) => {
      if(audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;

      const createOsc = (type, freq, time, duration, vol, rampToFreq = null) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        if(rampToFreq) osc.frequency.exponentialRampToValueAtTime(rampToFreq, time + duration);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol, time + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + duration);
        return { osc, gain };
      };

      if(tier === 'SS') {
        createOsc('sine', 150, now, 2.0, 0.6, 30); 
        createOsc('sawtooth', 300, now, 1.0, 0.3, 1500); 
        createOsc('square', 800, now + 0.8, 1.5, 0.2, 2500); 
        [400, 500, 600, 800, 1000, 1200, 1500].forEach((f, i) => createOsc('sine', f, now + 0.1 * i, 0.6, 0.3));
      } else if(tier === 'S') {
        createOsc('sine', 200, now, 1.5, 0.5, 50); 
        createOsc('triangle', 400, now, 1.0, 0.3, 1000);
        [500, 650, 800, 1000].forEach((f, i) => createOsc('sine', f, now + 0.15 * i, 0.5, 0.2));
      } else if(tier === 'A') {
        createOsc('triangle', 300, now, 0.8, 0.3, 800);
        createOsc('sine', 600, now + 0.1, 0.6, 0.2, 1200);
      } else if(tier === 'B') {
        createOsc('triangle', 400, now, 0.5, 0.2, 600);
        createOsc('sine', 800, now, 0.4, 0.1);
      } else {
        createOsc('square', 250, now, 0.15, 0.1, 50); 
        createOsc('sine', 700, now + 0.05, 0.4, 0.2); 
        createOsc('sine', 1050, now + 0.15, 0.5, 0.15); 
      }
    };

    window.playCardClickSound = (tier) => {
      if(audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;

      const createOsc = (type, freq, time, duration, vol) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol, time + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + duration);
      };

      if(tier === 'SS') {
        createOsc('triangle', 523.25, now, 0.3, 0.2);
        createOsc('triangle', 659.25, now + 0.05, 0.3, 0.2);
        createOsc('triangle', 783.99, now + 0.1, 0.3, 0.2);
        createOsc('sine', 1046.50, now + 0.15, 0.5, 0.3);
      } else if(tier === 'S') {
        createOsc('triangle', 523.25, now, 0.3, 0.2);
        createOsc('triangle', 659.25, now + 0.05, 0.3, 0.2);
        createOsc('sine', 783.99, now + 0.1, 0.4, 0.2);
      } else if(tier === 'A') {
        createOsc('triangle', 440.00, now, 0.2, 0.15);
        createOsc('sine', 554.37, now + 0.05, 0.3, 0.15);
      } else if(tier === 'B') {
        createOsc('triangle', 392.00, now, 0.2, 0.15);
        createOsc('sine', 493.88, now + 0.05, 0.2, 0.15);
      } else { 
        createOsc('sine', 349.23, now, 0.15, 0.1);
        createOsc('square', 200, now, 0.05, 0.05);
      }
    };

    window.fireConfetti = (tier) => {
      if(typeof confetti !== 'function') return;
      if(tier === 'SS') {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#ef4444', '#000000', '#ffffff'], zIndex: 1000 });
      } else if(tier === 'S') {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ['#facc15', '#ffffff'], zIndex: 1000 });
      }
    };
