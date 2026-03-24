// ============================================================
// app.js — Funções globais de aplicação
// Contém funções que estavam no <script type="module"> do
// index.html antigo e não foram migradas na refatoração:
// updateGachaUI, updateAllCardDependentUI, applyGlobalSettingsUI,
// logSystemAction, loadGlobalStats, suggestNextCardNumber,
// renderNotifications, toggleNotifications, clearNotifications,
// checkTierComplete, renderAchievements, claimAchievement,
// resetPackArea, showPasswordModal, changePassword,
// timer de recarga de pacotes.
//
// FIX conquistas: isOpeningAchiev, achievSelectedIndices e
// currentAchievType movidos para window scope para que gacha.js
// acesse o mesmo estado. userData atualizado localmente após
// cada claim sem esperar o onSnapshot.
// ============================================================

function initApp() {
  const db = window.db;
  const auth = window.auth;

  // ── Log de ações de sistema ───────────────────────────────────
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

  // ── Aplica configurações globais na UI ────────────────────────
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

  // Escuta mudanças nas configurações globais em tempo real
  if (window.onSnapshot && window.doc) {
    onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        window.globalSettings = docSnap.data();
        window.applyGlobalSettingsUI();
      }
    });
  }

  // ── Estatísticas globais (aba Comunidade) ─────────────────────
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

  // ── Atualiza UI da roleta (mostra/esconde pacote) ─────────────


  // ── Atualiza toda UI que depende do cardDatabase ──────────────
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

    // Lista de cartas no painel admin
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

    // Mostra/esconde conteúdo da roleta baseado em ter cartas
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

  // Chama loadCardsCache agora que o Firebase está pronto
  if (window.loadCardsCache) window.loadCardsCache();

  // ── Sugere próximo número de carta no admin ───────────────────
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

  // ── Notificações ──────────────────────────────────────────────
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

// ── Timer de recarga de pacotes ───────────────────────────────
const THREE_HOURS = 3 * 60 * 60 * 1000;
let isUpdatingPulls = false; // lock para evitar race condition

setInterval(() => {
  const ud = window.userData;
  const user = window.currentUser;
  if (!user || !ud) return;
  if (isUpdatingPulls) return; // já tem uma atualização em andamento

  if ((ud.pullsAvailable || 0) < 5 && ud.lastPullTimestamp) {
    const now = Date.now();
    const timePassed = now - ud.lastPullTimestamp;
    const pullsEarned = Math.floor(timePassed / THREE_HOURS);

    if (pullsEarned > 0) {
      const newPulls = Math.min(5, (ud.pullsAvailable || 0) + pullsEarned);
      let newTimestamp = ud.lastPullTimestamp + (pullsEarned * THREE_HOURS);
      if (newPulls === 5) newTimestamp = null;

      if (newPulls !== ud.pullsAvailable) {
        isUpdatingPulls = true; // trava o timer
        // Atualiza local ANTES do updateDoc para evitar recalculo
        ud.pullsAvailable = newPulls;
        ud.lastPullTimestamp = newTimestamp;

        updateDoc(doc(db, "users", user.uid), {
          pullsAvailable: newPulls,
          lastPullTimestamp: newTimestamp
        }).catch(() => {}).finally(() => {
          isUpdatingPulls = false; // libera após confirmar no Firestore
        });

        if (window.updateGachaUI) window.updateGachaUI();
      }
    }

    if ((ud.pullsAvailable || 0) < 5 && ud.lastPullTimestamp) {
      const timerContainer = document.getElementById('pull-timer-container');
      const timerText = document.getElementById('pull-timer');
      const largeTimer = document.getElementById('large-pull-timer');

      if (timerContainer) timerContainer.classList.remove('hidden');

      const timeLeft = THREE_HOURS - ((Date.now() - ud.lastPullTimestamp) % THREE_HOURS);
      const h = Math.floor(timeLeft / (1000 * 60 * 60)).toString().padStart(2, '0');
      const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const s = Math.floor((timeLeft % (1000 * 60)) / 1000).toString().padStart(2, '0');
      const timeString = `${h}h ${m}m ${s}s`;

      if (timerText) timerText.innerText = timeString;
      if (largeTimer) largeTimer.innerText = timeString;
    }
  } else {
    const timerContainer = document.getElementById('pull-timer-container');
    if (timerContainer) timerContainer.classList.add('hidden');
  }
}, 1000);

  // ── Resetar área de pacotes após abrir ────────────────────────
  window.resetPackArea = () => {
    const revealedCards = document.getElementById('revealed-cards');
    const btnNext = document.getElementById('btn-next');
    if (revealedCards) revealedCards.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    window.updateGachaUI();
  };

  // ── Verificar se tier está completo (conquistas) ──────────────
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

  // ── Sistema de Conquistas ─────────────────────────────────────
  window.renderAchievements = () => {
    const grid = document.getElementById('achievements-grid');
    if (!grid || !window.currentUser) return;

    const ud = window.userData || {};
    const totalOpened = ud.totalPacksOpened || 0;
    const claimedTens = ud.claimedAchievements?.tens || 0;
    const maxTens = Math.floor(totalOpened / 10);
    const tensIsReady = maxTens > claimedTens;

    const achievements = [
      {
        id: 'first5', title: 'Primeiros Passos',
        desc: 'Abra 5 pacotes básicos. <br><span class="text-[10px] text-gray-500">Prêmio: +5 Pacotes Básicos</span>',
        isReady: totalOpened >= 5, isClaimed: ud.claimedAchievements?.first5,
        type: 'basic_pulls', progress: `${Math.min(5, totalOpened)}/5`
      },
      {
        id: 'tens', title: 'Veterano Constante',
        desc: 'A cada 10 pacotes abertos, ganhe 1 Premium.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium (S/SS)</span>',
        isReady: tensIsReady, isClaimed: false,
        type: 'premium', progress: `${totalOpened % 10}/10`, isRepeatable: true
      },
      {
        id: 'tierC', title: 'Colecionador Rank C 🥉',
        desc: 'Obtenha todas as cartas Rank C.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('C'), isClaimed: ud.claimedAchievements?.tierC, type: 'premium'
      },
      {
        id: 'tierB', title: 'Colecionador Rank B 🥈',
        desc: 'Obtenha todas as cartas Rank B.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('B'), isClaimed: ud.claimedAchievements?.tierB, type: 'premium'
      },
      {
        id: 'tierA', title: 'Colecionador Rank A 🥇',
        desc: 'Obtenha todas as cartas Rank A.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('A'), isClaimed: ud.claimedAchievements?.tierA, type: 'premium'
      },
      {
        id: 'tierS', title: 'Colecionador Rank S 💎',
        desc: 'Obtenha todas as cartas Rank S.<br><span class="text-[10px] text-gray-500">Prêmio: Pacote Premium</span>',
        isReady: window.checkTierComplete('S'), isClaimed: ud.claimedAchievements?.tierS, type: 'premium'
      },
      {
        id: 'tierSS', title: 'Colecionador Rank SS 🌟',
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

  // FIX: as 3 variáveis de estado do overlay de conquistas eram "let" locais
  // dentro de initApp(). gacha.js declara suas próprias cópias locais com
  // os mesmos nomes, então os dois arquivos nunca compartilhavam o mesmo estado.
  // Resultado: closeAchievOverlay() em gacha.js setava isOpeningAchiev = false
  // na cópia local de gacha.js, mas claimAchievement() aqui lia a cópia local
  // de initApp() que nunca voltava a false — travando todos os claims seguintes.
  // Solução: mover para window scope. O "|| valor" evita sobrescrever caso
  // gacha.js já tenha inicializado antes (ordem de carregamento variável).
  window.isOpeningAchiev       = window.isOpeningAchiev       || false;
  window.achievSelectedIndices = window.achievSelectedIndices || [];
  window.currentAchievType     = window.currentAchievType     || 'basic';

  window.claimAchievement = async (achievId, type) => {
    if (window.isOpeningAchiev) return;  // FIX: lê window scope

    const ud = window.userData || {};
    const totalOpened = ud.totalPacksOpened || 0;

    if (achievId === 'tens') {
      const claimedTens = ud.claimedAchievements?.tens || 0;
      const maxTens = Math.floor(totalOpened / 10);
      if (maxTens <= claimedTens) return;
    } else {
      if (ud.claimedAchievements?.[achievId]) return;
    }

    window.isOpeningAchiev = true;  // FIX: seta window scope
    const btn = document.getElementById(`btn-claim-${achievId}`);
    if (btn) { btn.disabled = true; btn.innerText = "Processando..."; }

    const newClaimed = { ...(ud.claimedAchievements || {}) };
    if (achievId === 'tens') {
      newClaimed.tens = (newClaimed.tens || 0) + 1;
    } else {
      newClaimed[achievId] = true;
    }

    try {
      const updateObj = { claimedAchievements: newClaimed };

      if (achievId === 'first5') {
        updateObj.pullsAvailable = increment(5);
        await updateDoc(doc(db, "users", window.currentUser.uid), updateObj);

        // FIX: atualiza userData local — não espera onSnapshot (pode demorar 1-3s)
        window.userData.claimedAchievements = newClaimed;
        window.userData.pullsAvailable = (window.userData.pullsAvailable || 0) + 5;

        window.isOpeningAchiev = false;  // libera para próximos claims
        window.showMessage("Parabéns! Resgatou +5 Pacotes Básicos! Vá à aba Roleta para abri-los.");
        window.updateGachaUI();
        window.renderAchievements();
        return;
      }

      const cards = window.cardDatabase;
      if (!cards || cards.length === 0) throw new Error("Banco de cartas vazio.");

      const getCard = (isPrem) => {
        const TIER_VALUES = window.TIER_VALUES || { C: 1, B: 2, A: 3, S: 4, SS: 5 };
        let tier = 'C';
        if (isPrem) {
          tier = Math.random() * 100 + 1 <= 90 ? 'S' : 'SS';
        } else {
          const r = Math.floor(Math.random() * 10000) + 1;
          if (r <= 5600) tier = 'C';
          else if (r <= 8600) tier = 'B';
          else if (r <= 9630) tier = 'A';
          else if (r <= 9980) tier = 'S';
          else tier = 'SS';
        }
        let pool = cards.filter(c => c.tier === tier);
        if (!pool.length) pool = cards;
        return pool[Math.floor(Math.random() * pool.length)];
      };

      const isPremium = type === 'premium';
      const generatedCards = Array.from({ length: 8 }, () => getCard(isPremium));
      const shuffled = [...generatedCards].sort(() => 0.5 - Math.random());
      const wonCards = [shuffled[0], shuffled[1]];
      const missedCards = shuffled.slice(2);

      const newInv = { ...(ud.inventory || {}) };
      newInv[wonCards[0].id] = (newInv[wonCards[0].id] || 0) + 1;
      newInv[wonCards[1].id] = (newInv[wonCards[1].id] || 0) + 1;
      updateObj.inventory = newInv;

      await updateDoc(doc(db, "users", window.currentUser.uid), updateObj);

      // FIX: atualiza userData local imediatamente após gravar no Firestore.
      // Sem isso, a 2ª conquista leria claimedAchievements desatualizado
      // do snapshot anterior enquanto o onSnapshot ainda não retornou.
      window.userData.claimedAchievements = newClaimed;
      window.userData.inventory = newInv;

      window.currentAchievWonCards = wonCards;
      window.currentAchievMissedCards = missedCards;
      window.achievRevealedCount = 0;
      window.achievSelectedIndices = [];    // FIX: window scope, limpa o claim anterior
      window.currentAchievType = type;      // FIX: window scope, gacha.js lê daqui

      if (window.logSystemAction) {
        const c1 = wonCards[0], c2 = wonCards[1];
        window.logSystemAction(`${window.currentUser.displayName} resgatou conquista "${achievId}" e obteve ${c1.name} (R.${c1.tier}) e ${c2.name} (R.${c2.tier}).`);
      }

      // Abre overlay do pacote de conquista
      const overlay     = document.getElementById('achiev-pack-overlay');
      const pack        = document.getElementById('achiev-booster-pack');
      const revealed    = document.getElementById('achiev-revealed-cards');
      const btnClose    = document.getElementById('btn-achiev-close');
      const bgPremium   = document.getElementById('achiev-pack-bg');
      const iconPremium = document.getElementById('achiev-pack-icon-premium');
      const iconBasic   = document.getElementById('achiev-pack-icon-basic');
      const label       = document.getElementById('achiev-pack-label');
      const sublabel    = document.getElementById('achiev-pack-sublabel');
      const overlayTitle = document.getElementById('achiev-overlay-title');

      // FIX: limpa grade de cartas do claim anterior antes de abrir novo overlay
      if (revealed) revealed.innerHTML = '';

      if (isPremium && bgPremium && iconPremium && iconBasic && label && sublabel) {
        pack.className = 'pack pack-premium glowing-premium cursor-pointer';
        bgPremium.classList.remove('hidden');
        iconPremium.classList.remove('hidden');
        iconBasic.classList.add('hidden');
        label.innerText = "PREMIUM";
        label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10";
        sublabel.innerText = "Pacote de Conquista";
        sublabel.className = "block text-xs text-yellow-200 font-bold tracking-widest uppercase bg-black/50 px-2 py-1 rounded z-10";
      } else if (!isPremium && bgPremium && iconPremium && iconBasic && label && sublabel) {
        // FIX: reseta visual para básico caso claim anterior fosse premium
        pack.className = 'pack cursor-pointer';
        bgPremium.classList.add('hidden');
        iconPremium.classList.add('hidden');
        iconBasic.classList.remove('hidden');
        label.innerText = "NIN";
        label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-green-300 to-green-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10";
        sublabel.innerText = "Pacote Básico";
        sublabel.className = "block text-xs text-gray-300 font-bold tracking-widest uppercase z-10";
      }

      // FIX: remove 'tearing' que pode ter ficado do claim anterior
      if (pack) { pack.classList.remove('hidden', 'tearing'); }
      if (revealed) revealed.classList.add('hidden');
      if (btnClose) btnClose.classList.add('hidden');
      if (overlayTitle) { overlayTitle.innerText = "Abra a sua Recompensa!"; overlayTitle.classList.add('animate-pulse'); }
      if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }

      window.updateGachaUI();
      window.renderAchievements();

    } catch (e) {
      window.showMessage("Erro ao resgatar conquista: " + e.message);
      window.isOpeningAchiev = false;  // FIX: libera em caso de erro
      if (btn) { btn.disabled = false; btn.innerText = "RESGATAR E ABRIR!"; }
    }
    // NOTA: window.isOpeningAchiev só volta a false em closeAchievOverlay() (gacha.js)
  };

  // ── getUserMedals (versão original do código antigo) ──────────
  window.getUserMedals = (inventory) => {
    if (!inventory || !window.cardDatabase?.length) return '';

    const totalCounts = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
    window.cardDatabase.forEach(c => totalCounts[c.tier]++);

    const userCounts = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
    Object.keys(inventory).forEach(id => {
      if (inventory[id] > 0) {
        const c = window.cardDatabase.find(card => card.id === id);
        if (c) userCounts[c.tier]++;
      }
    });

    const hasC = totalCounts.C > 0 && userCounts.C === totalCounts.C;
    const hasB = totalCounts.B > 0 && userCounts.B === totalCounts.B;
    const hasA = totalCounts.A > 0 && userCounts.A === totalCounts.A;
    const hasS = totalCounts.S > 0 && userCounts.S === totalCounts.S;
    const hasSS = totalCounts.SS > 0 && userCounts.SS === totalCounts.SS;
    const hasALL = hasC && hasB && hasA && hasS && hasSS;

    if (hasALL) return `<span title="Mestre Ninja Absoluto!" class="text-xl drop-shadow-[0_0_10px_#ff0000]">🔥</span>`;
    if (hasSS) return `<span title="Colecionador Rank SS" class="text-xl drop-shadow-[0_0_5px_#ff00ff]">🌟</span>`;
    if (hasS) return `<span title="Colecionador Rank S" class="text-xl drop-shadow-[0_0_5px_#00ffff]">💎</span>`;
    if (hasA) return `<span title="Colecionador Rank A" class="text-xl drop-shadow-[0_0_5px_#ffd700]">🥇</span>`;
    if (hasB) return `<span title="Colecionador Rank B" class="text-xl drop-shadow-[0_0_5px_#c0c0c0]">🥈</span>`;
    if (hasC) return `<span title="Colecionador Rank C" class="text-xl drop-shadow-[0_0_5px_#cd7f32]">🥉</span>`;
    return '';
  };

} // fim initApp

// Aguarda Firebase estar pronto
if (window._firebaseReady) {
  initApp();
} else {
  window.addEventListener('firebase-ready', initApp, { once: true });
}
