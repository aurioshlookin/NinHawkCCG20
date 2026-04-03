// ===========================================================
// app.js — Funções globais de aplicação
// ===========================================================

function initApp() {
  const db = window.db;
  const auth = window.auth;

  window.logSystemAction = async (actionText) => {
    if (!window.currentUser) return;
    try {
      await addDoc(collection(db, "system_logs"), {
        action: actionText,
        timestamp: new Date()
      });
    } catch (e) {
      console.warn("Falha ao registrar log:", e);
    }
  };

  window.applyGlobalSettingsUI = () => {
    const gs = window.globalSettings || {};

    const maintOverlay = document.getElementById('maintenance-overlay');
    if (maintOverlay) {
      if (gs.maintenanceMode && !(window.userData?.role === 'admin')) {
        maintOverlay.classList.remove('hidden');
        maintOverlay.classList.add('flex');
      } else {
        maintOverlay.classList.add('hidden');
        maintOverlay.classList.remove('flex');
      }
    }

    const adminRegStatus = document.getElementById('admin-reg-status');
    if (adminRegStatus) {
      adminRegStatus.innerText = gs.registrationsOpen ? 'LIGADO' : 'DESLIGADO';
      adminRegStatus.className = gs.registrationsOpen ? 'text-green-400 font-bold' : 'text-red-400 font-bold';
    }

    const adminMaintStatus = document.getElementById('admin-maint-status');
    if (adminMaintStatus) {
      adminMaintStatus.innerText = gs.maintenanceMode ? 'LIGADO' : 'DESLIGADO';
      adminMaintStatus.className = gs.maintenanceMode ? 'text-red-400 font-bold' : 'text-gray-400 font-bold';
    }
  };

  if (window.onSnapshot && window.doc) {
    onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        window.globalSettings = docSnap.data();
        window.applyGlobalSettingsUI();
      }
    });
  }

  window.loadGlobalStats = async () => {
    try {
      const statsSnap = await getDoc(doc(db, "settings", "globalStats"));
      if (statsSnap.exists()) {
        const data = statsSnap.data();
        const packEl = document.getElementById('explore-total-packs');
        const tradeEl = document.getElementById('explore-total-trades');
        if (packEl) packEl.innerText = data.totalPacks || 0;
        if (tradeEl) tradeEl.innerText = data.totalTrades || 0;
      }
    } catch (err) {}
  };

  window.updateAllCardDependentUI = () => {
    const count = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
    window.cardDatabase.forEach(c => { if (count[c.tier] !== undefined) count[c.tier]++; });

    const total = window.cardDatabase.length;
    let baseTotalForIdeal = count['SS'] > 0 ? count['SS'] * 50 : (total > 0 ? total : 50);

    const ideal = {
      C: Math.round(baseTotalForIdeal * 0.50),
      B: Math.round(baseTotalForIdeal * 0.30),
      A: Math.round(baseTotalForIdeal * 0.12),
      S: Math.round(baseTotalForIdeal * 0.06),
      SS: count['SS'] > 0 ? count['SS'] : Math.round(baseTotalForIdeal * 0.02)
    };

    ['C', 'B', 'A', 'S', 'SS'].forEach(tier => {
      const el = document.getElementById(`admin-count-${tier.toLowerCase()}`);
      if (el) el.innerHTML = `${count[tier]} <span class="text-sm font-normal text-gray-500">/ ${ideal[tier]}</span>`;
    });

    const totalCardsEl = document.getElementById('total-cards-count');
    const adminCountEl = document.getElementById('admin-card-count');
    if (totalCardsEl) totalCardsEl.innerText = total;
    if (adminCountEl) adminCountEl.innerText = total;

    const adminListContainer = document.getElementById('admin-card-list-container');
    if (adminListContainer && window.currentUser && window.userData?.role === 'admin') {
      adminListContainer.innerHTML = '';
      const TIER_ORDER = ['SS', 'S', 'A', 'B', 'C'];
      const TIER_VALUES = window.TIER_VALUES || { C: 1, B: 2, A: 3, S: 4, SS: 5 };
      let sortedAdminDb = [...window.cardDatabase].sort((a, b) => (a.cardNumber || '0').localeCompare(b.cardNumber || '0'));

      TIER_ORDER.forEach(tier => {
        const tierCards = sortedAdminDb.filter(c => c.tier === tier);
        if (tierCards.length === 0) return;

        const tierColorText = { C: 'text-green-400', B: 'text-blue-400', A: 'text-purple-400', S: 'text-yellow-400', SS: 'text-red-500' };
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'bg-gray-800/50 p-4 rounded-xl border border-gray-700 mb-6';
        sectionDiv.innerHTML = `
          <h3 class="text-xl font-bold border-b border-gray-700 pb-2 mb-4 text-white flex justify-between items-center">
            <span class="${tierColorText[tier]} uppercase tracking-wider">Rank ${tier}</span>
            <span class="text-sm bg-gray-900 border border-gray-700 px-3 py-1 rounded-full text-gray-400 font-bold">${tierCards.length} cartas</span>
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" id="admin-tier-grid-${tier}"></div>
        `;
        adminListContainer.appendChild(sectionDiv);

        const tierGrid = document.getElementById(`admin-tier-grid-${tier}`);
        tierCards.forEach(c => {
          const cardWrapper = document.createElement('div');
          cardWrapper.className = 'flex flex-col items-center gap-2 w-full';

          const visualWrapper = document.createElement('div');
          visualWrapper.className = 'w-full aspect-[2/3] relative rounded-xl shadow-lg';

          const cardVisualContainer = document.createElement('div');
          cardVisualContainer.className = 'w-full h-full';
          cardVisualContainer.id = `admin-card-visual-${c.id}`;
          visualWrapper.appendChild(cardVisualContainer);

          const actionButtons = document.createElement('div');
          actionButtons.className = 'flex gap-2 w-full mt-1';
          const safeName = (c.name || '').replace(/'/g, "\\'");
          actionButtons.innerHTML = `
            <button type="button" onclick="window.editCard('${c.id}')" class="flex-1 text-green-400 hover:text-green-300 text-xs font-bold bg-gray-700 hover:bg-gray-600 py-1.5 rounded border border-gray-600 transition shadow">Editar</button>
            <button type="button" onclick="window.deleteCard('${c.id}', '${safeName}')" class="flex-1 text-red-400 hover:text-red-300 text-xs font-bold bg-gray-700 hover:bg-gray-600 py-1.5 rounded border border-gray-600 transition shadow">Excluir</button>
          `;

          cardWrapper.appendChild(visualWrapper);
          cardWrapper.appendChild(actionButtons);
          tierGrid.appendChild(cardWrapper);

          window.renderCardHTML(`admin-card-visual-${c.id}`, c, false, true, {});
        });
      });
    }

    const gachaContent = document.getElementById('gacha-content');
    const gachaEmpty = document.getElementById('gacha-empty-db');

    if (total === 0) {
      if (gachaContent) { gachaContent.classList.add('hidden'); gachaContent.classList.remove('flex'); }
      if (window.currentUser && gachaEmpty) gachaEmpty.classList.remove('hidden');
    } else {
      if (gachaContent) { gachaContent.classList.remove('hidden'); gachaContent.classList.add('flex'); }
      if (gachaEmpty) gachaEmpty.classList.add('hidden');
    }

    if (window.currentUser) {
      if (window.renderAlbumHTML) window.renderAlbumHTML('album-grid', window.userData?.inventory || {});
      if (window.updateTradeOptions) window.updateTradeOptions();
      if (window.renderAchievements) window.renderAchievements();
      if (window.renderTradeBoard) window.renderTradeBoard();
      const raritySection = document.getElementById('section-rarity');
      if (raritySection && !raritySection.classList.contains('hidden')) {
        if (window.renderRarityBoard) window.renderRarityBoard();
      }
    }
  };

  if (window.loadCardsCache) window.loadCardsCache();

  window.suggestNextCardNumber = () => {
    if (typeof editingCardId !== 'undefined' && editingCardId) return;
    let maxNum = 0;
    window.cardDatabase.forEach(c => {
      const num = parseInt(c.cardNumber, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    const nextStr = String(maxNum + 1).padStart(3, '0');
    const numInput = document.getElementById('admin-card-number');
    if (numInput) {
      numInput.value = nextStr;
      if (window.updateAdminPreview) window.updateAdminPreview();
    }
  };

  window.renderNotifications = (notifs) => {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    if (!list || !badge) return;

    if (!notifs || notifs.length === 0) {
      list.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Nenhuma notificação.</div>';
      badge.classList.add('hidden');
      return;
    }

    const unreadCount = notifs.filter(n => !n.read).length;
    if (unreadCount > 0) {
      badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    list.innerHTML = notifs.map(n => `
      <div class="p-4 text-sm transition ${!n.read ? 'bg-gray-700/80 border-l-4 border-green-500' : 'hover:bg-gray-700/40'}">
        <div class="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">${new Date(n.timestamp).toLocaleString('pt-BR')}</div>
        <div class="text-gray-200 leading-relaxed">${n.message}</div>
      </div>
    `).join('');
  };

  window.toggleNotifications = () => {
    const drop = document.getElementById('notif-dropdown');
    if (!drop) return;

    drop.classList.toggle('hidden');
    drop.classList.toggle('flex');

    if (!drop.classList.contains('hidden') && window.currentUser) {
      const notifs = window.userData?.notifications || [];
      let changed = false;
      const updatedNotifs = notifs.map(n => {
        if (!n.read) { n.read = true; changed = true; }
        return n;
      });
      if (changed) {
        updateDoc(doc(db, "users", window.currentUser.uid), { notifications: updatedNotifs }).catch(() => {});
      }
    }
  };

  window.clearNotifications = async () => {
    if (!window.currentUser) return;
    try {
      await updateDoc(doc(db, "users", window.currentUser.uid), { notifications: [] });
    } catch (e) {}
  };

  const THREE_HOURS = 3 * 60 * 60 * 1000;

  setInterval(() => {
    const ud = window.userData;
    const user = window.currentUser;
    if (!user || !ud) return;

    if ((ud.pullsAvailable || 0) < 5 && ud.lastPullTimestamp) {
      let ts = ud.lastPullTimestamp;
      if (ts?.toMillis) ts = ts.toMillis();
      else if (ts?.seconds) ts = ts.seconds * 1000;
      ts = Number(ts);

      if (!ts || isNaN(ts) || ts > Date.now()) {
        const timerContainer = document.getElementById('pull-timer-container');
        if (timerContainer) timerContainer.classList.add('hidden');
        return;
      }

      const timerContainer = document.getElementById('pull-timer-container');
      const timerText = document.getElementById('pull-timer');
      const largeTimer = document.getElementById('large-pull-timer');

      if (timerContainer) timerContainer.classList.remove('hidden');

      const timeLeft = THREE_HOURS - ((Date.now() - ts) % THREE_HOURS);
      const h = Math.floor(timeLeft / (1000 * 60 * 60)).toString().padStart(2, '0');
      const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const s = Math.floor((timeLeft % (1000 * 60)) / 1000).toString().padStart(2, '0');

      if (timerText) timerText.innerText = `${h}h ${m}m ${s}s`;
      if (largeTimer) largeTimer.innerText = `${h}h ${m}m ${s}s`;
    } else {
      const timerContainer = document.getElementById('pull-timer-container');
      if (timerContainer) timerContainer.classList.add('hidden');
    }
  }, 1000);

  window.resetPackArea = () => {
    const revealedCards = document.getElementById('revealed-cards');
    const btnNext = document.getElementById('btn-next');
    if (revealedCards) revealedCards.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    window.updateGachaUI();
  };

  window.checkTierComplete = (tier) => {
    if (!window.cardDatabase?.length) return false;
    const inv = window.userData?.inventory || {};
    let total = 0, owned = 0;
    window.cardDatabase.forEach(c => {
      if (c.tier === tier) {
        total++;
        if ((inv[c.id] || 0) > 0) owned++;
      }
    });
    return total > 0 && owned === total;
  };

  window.renderAchievements = () => {
    const grid = document.getElementById('achievements-grid');
    if (!grid || !window.currentUser) return;

    const ud = window.userData || {};
    const totalOpened = ud.totalPacksOpened || 0;
    const claimedTens = ud.claimedAchievements?.tens || 0;
    const maxTens = Math.floor(totalOpened / 10);
    const tensIsReady = maxTens > claimedTens;

    // Helper para gerar as shurikens nos títulos das missões
    const getAchievShuriken = (colorClass) => `
      <span class="inline-block ml-1 align-text-bottom">
        <svg viewBox="0 0 24 24" class="w-6 h-6 ${colorClass} fill-gray-800 stroke-2" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
          <circle cx="12" cy="12" r="2.5" class="fill-gray-900" />
        </svg>
      </span>
    `;

    const achievements = [
      {
        id: 'first5', title: 'Primeiros Passos 🚶‍♂️',
        desc: 'Abra 5 pacotes básicos. <br><span class="text-[10px] text-gray-500">Prêmio: +5 Pacotes Básicos</span>',
        isReady: totalOpened >= 5, isClaimed: ud.claimedAchievements?.first5,
        type: 'basic_pulls', progress: `${Math.min(5, totalOpened)}/5`
      },
      {
        id: 'tens', title: 'Veterano Constante 🔁',
        desc: 'A cada 10 pacotes abertos, ganhe 1 Premium.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium (S/SS)</span>',
        isReady: tensIsReady, isClaimed: false,
        type: 'premium', progress: `${totalOpened % 10}/10`, isRepeatable: true
      },
      {
        id: 'tierC', title: 'Colecionador Rank C ' + getAchievShuriken('stroke-green-400 drop-shadow-[0_0_3px_rgba(74,222,128,0.8)]'),
        desc: 'Obtenha todas as cartas Rank C.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('C'), isClaimed: ud.claimedAchievements?.tierC, type: 'premium'
      },
      {
        id: 'tierB', title: 'Colecionador Rank B ' + getAchievShuriken('stroke-blue-400 drop-shadow-[0_0_3px_rgba(96,165,250,0.8)]'),
        desc: 'Obtenha todas as cartas Rank B.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('B'), isClaimed: ud.claimedAchievements?.tierB, type: 'premium'
      },
      {
        id: 'tierA', title: 'Colecionador Rank A ' + getAchievShuriken('stroke-purple-400 drop-shadow-[0_0_3px_rgba(192,132,252,0.8)]'),
        desc: 'Obtenha todas as cartas Rank A.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('A'), isClaimed: ud.claimedAchievements?.tierA, type: 'premium'
      },
      {
        id: 'tierS', title: 'Colecionador Rank S ' + getAchievShuriken('stroke-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]'),
        desc: 'Obtenha todas as cartas Rank S.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('S'), isClaimed: ud.claimedAchievements?.tierS, type: 'premium'
      },
      {
        id: 'tierSS', title: 'Colecionador Rank SS ' + getAchievShuriken('stroke-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,1)] animate-pulse'),
        desc: 'Obtenha todas as cartas Rank SS.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('SS'), isClaimed: ud.claimedAchievements?.tierSS, type: 'premium'
      }
    ];

    grid.innerHTML = '';
    achievements.forEach(achiev => {
      const bgClass = achiev.isClaimed && !achiev.isRepeatable ? 'bg-gray-800 opacity-50' : 'bg-gray-800';
      const borderClass = achiev.isReady && !achiev.isClaimed
        ? (achiev.type === 'premium' ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]')
        : 'border-gray-700';

      let btnHTML = '';
      if (achiev.isClaimed && !achiev.isRepeatable) {
        btnHTML = `<button disabled class="w-full bg-gray-700 text-gray-400 font-bold py-2 rounded-lg cursor-not-allowed">Já Resgatado</button>`;
      } else if (achiev.isReady) {
        const colorBtn = achiev.type === 'premium' ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white';
        const btnText = achiev.type === 'basic_pulls' ? 'RESGATAR PACOTES' : 'RESGATAR E ABRIR!';
        btnHTML = `<button id="btn-claim-${achiev.id}" onclick="window.claimAchievement('${achiev.id}', '${achiev.type}')" class="w-full ${colorBtn} font-bold py-2 rounded-lg transition shadow-lg animate-pulse">${btnText}</button>`;
      } else {
        btnHTML = `<button disabled class="w-full bg-gray-900 border border-gray-600 text-gray-500 font-bold py-2 rounded-lg cursor-not-allowed">Bloqueado</button>`;
      }

      grid.innerHTML += `
        <div class="${bgClass} border ${borderClass} p-5 rounded-xl flex flex-col justify-between transition-all">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-xl font-bold ${achiev.type === 'premium' ? 'text-yellow-400' : 'text-green-400'}">${achiev.title}</h3>
              <p class="text-sm text-gray-300 mt-1">${achiev.desc}</p>
            </div>
            ${achiev.progress ? `<span class="bg-gray-900 border border-gray-600 px-2 py-1 rounded text-xs font-bold text-gray-400">${achiev.progress}</span>` : ''}
          </div>
          ${btnHTML}
        </div>
      `;
    });
  };

  window.isOpeningAchiev       = window.isOpeningAchiev       || false;
  window.achievSelectedIndices = window.achievSelectedIndices || [];
  window.currentAchievType     = window.currentAchievType     || 'basic';

  // ============================================================
  // claimAchievement — chama a Cloud Function (seguro)
  // ============================================================
  window.claimAchievement = async (achievId, type) => {
    if (window.isOpeningAchiev) return;

    const ud = window.userData || {};
    const totalOpened = ud.totalPacksOpened || 0;

    // Validação rápida no cliente (a CF valida novamente no servidor)
    if (achievId === 'tens') {
      const claimedTens = ud.claimedAchievements?.tens || 0;
      const maxTens = Math.floor(totalOpened / 10);
      if (maxTens <= claimedTens) return;
    } else {
      if (ud.claimedAchievements?.[achievId]) return;
    }

    window.isOpeningAchiev = true;
    const btn = document.getElementById(`btn-claim-${achievId}`);
    if (btn) { btn.disabled = true; btn.innerText = "Processando..."; }

    try {
      const token    = await window.currentUser.getIdToken();
      const response = await fetch(
        `${window.CLOUD_FUNCTIONS_URL}/claimAchievement`,
        {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ achievId, type }),
        }
      );

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || "Erro ao resgatar conquista.");
      }

      const result = json.data;

      // Atualiza estado local imediatamente (sem esperar onSnapshot)
      window.userData.claimedAchievements = result.newClaimed;

      // Conquista de packs básicos: só mostra mensagem
      if (result.type === 'basic_pulls') {
        window.isOpeningAchiev = false;
        window.showMessage("Parabéns! Resgatou +5 Pacotes Básicos! Vá à aba Roleta para abri-los.");
        window.updateGachaUI();
        window.renderAchievements();
        return;
      }

      // Conquistas com cartas: prepara overlay igual ao pacote
      window.currentAchievWonCards  = result.wonCards;
      window.currentAchievMissedCards = result.missedCards;
      window.achievRevealedCount    = 0;
      window.achievSelectedIndices  = [];
      window.currentAchievType      = result.type;

      // Atualiza inventário local com as cartas ganhas
      const wonIds = result.wonCards.map(c => c.id);
      const inv = { ...(window.userData.inventory || {}) };
      wonIds.forEach(id => { inv[id] = (inv[id] || 0) + 1; });
      window.userData.inventory = inv;

      // Abre overlay do pacote de conquista
      const overlay      = document.getElementById('achiev-pack-overlay');
      const pack         = document.getElementById('achiev-booster-pack');
      const revealed     = document.getElementById('achiev-revealed-cards');
      const btnClose     = document.getElementById('btn-achiev-close');
      const bgPremium    = document.getElementById('achiev-pack-bg');
      const iconPremium  = document.getElementById('achiev-pack-icon-premium');
      const iconBasic    = document.getElementById('achiev-pack-icon-basic');
      const label        = document.getElementById('achiev-pack-label');
      const sublabel     = document.getElementById('achiev-pack-sublabel');
      const overlayTitle = document.getElementById('achiev-overlay-title');

      if (revealed) revealed.innerHTML = '';

      const isPremium = result.type === 'premium';
      if (isPremium && bgPremium) {
        pack.className = 'pack pack-premium glowing-premium cursor-pointer';
        bgPremium.classList.remove('hidden');
        if (iconPremium) iconPremium.classList.remove('hidden');
        if (iconBasic)   iconBasic.classList.add('hidden');
        if (label)    { label.innerText = "PREMIUM"; label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10"; }
        if (sublabel) { sublabel.innerText = "Pacote de Conquista"; sublabel.className = "block text-xs text-yellow-200 font-bold tracking-widest uppercase bg-black/50 px-2 py-1 rounded z-10"; }
      } else if (!isPremium && bgPremium) {
        pack.className = 'pack cursor-pointer';
        bgPremium.classList.add('hidden');
        if (iconPremium) iconPremium.classList.add('hidden');
        if (iconBasic)   iconBasic.classList.remove('hidden');
        if (label)    { label.innerText = "NIN"; label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-green-300 to-green-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10"; }
        if (sublabel) { sublabel.innerText = "Pacote Básico"; sublabel.className = "block text-xs text-gray-300 font-bold tracking-widest uppercase z-10"; }
      }

      if (pack)         { pack.classList.remove('hidden', 'tearing'); }
      if (revealed)     revealed.classList.add('hidden');
      if (btnClose)     btnClose.classList.add('hidden');
      if (overlayTitle) { overlayTitle.innerText = "Abra a sua Recompensa!"; overlayTitle.classList.add('animate-pulse'); }
      if (overlay)      { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }

      window.updateGachaUI();
      window.renderAchievements();

    } catch (e) {
      window.showMessage("Erro ao resgatar conquista: " + e.message);
      window.isOpeningAchiev = false;
      if (btn) { btn.disabled = false; btn.innerText = "RESGATAR E ABRIR!"; }
    }
    // window.isOpeningAchiev volta a false em closeAchievOverlay() (gacha.js)
  };

  // Aqui é onde fica a Shuriken global (inclusive no cabeçalho) com o Title Consertado!
  window.getUserMedals = (inventory) => {
    if (!inventory || !window.cardDatabase) return '';

    const medals = [];
    const tierCounts = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
    const tierTotals = { C: 0, B: 0, A: 0, S: 0, SS: 0 };

    window.cardDatabase.forEach(card => {
      tierTotals[card.tier] = (tierTotals[card.tier] || 0) + 1;
      if ((inventory[card.id] || 0) > 0) {
        tierCounts[card.tier] = (tierCounts[card.tier] || 0) + 1;
      }
    });

    // O truque mestre: Envolver o SVG numa tag <span> que controla o hover (title)
    const getShuriken = (colorClass, title) => `
      <span title="${title}" class="inline-block mx-[2px] cursor-help transition-transform hover:scale-125">
        <svg viewBox="0 0 24 24" class="w-5 h-5 ${colorClass} fill-gray-800 stroke-2" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
          <circle cx="12" cy="12" r="2.5" class="fill-gray-900" />
        </svg>
      </span>
    `;

    if (tierTotals.C > 0 && tierCounts.C >= tierTotals.C) medals.push(getShuriken('stroke-green-400 drop-shadow-[0_0_3px_rgba(74,222,128,0.8)]', 'Coleção C Completa!'));
    if (tierTotals.B > 0 && tierCounts.B >= tierTotals.B) medals.push(getShuriken('stroke-blue-400 drop-shadow-[0_0_3px_rgba(96,165,250,0.8)]', 'Coleção B Completa!'));
    if (tierTotals.A > 0 && tierCounts.A >= tierTotals.A) medals.push(getShuriken('stroke-purple-400 drop-shadow-[0_0_3px_rgba(192,132,252,0.8)]', 'Coleção A Completa!'));
    if (tierTotals.S > 0 && tierCounts.S >= tierTotals.S) medals.push(getShuriken('stroke-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]', 'Coleção S Completa!'));
    if (tierTotals.SS > 0 && tierCounts.SS >= tierTotals.SS) medals.push(getShuriken('stroke-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,1)] animate-pulse', 'Coleção SS Completa!'));

    const totalCards = window.cardDatabase.length;
    const totalOwned = Object.values(tierCounts).reduce((a, b) => a + b, 0);
    if (totalCards > 0 && totalOwned >= totalCards) {
       medals.push(`
        <span title="Mestre Ninja! Todas as cartas do jogo." class="inline-block mx-[2px] cursor-help transition-transform hover:scale-125">
          <svg viewBox="0 0 24 24" class="w-6 h-6 stroke-yellow-200 fill-yellow-500 stroke-2 drop-shadow-[0_0_8px_rgba(250,204,21,1)] animate-[spin_3s_linear_infinite]" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
            <circle cx="12" cy="12" r="3" class="fill-yellow-900" />
          </svg>
        </span>
       `);
    }

    return `<div class="flex items-center justify-center">${medals.join('')}</div>`;
  };

} // fim initApp

if (window._firebaseReady) {
  initApp();
} else {
  window.addEventListener('firebase-ready', initApp, { once: true });
}