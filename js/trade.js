// ============================================================
// trade.js — Sistema de Trocas
// ============================================================

const TRADE_RATIOS = {
  'SS': { 'SS': 1, 'S': 2, 'A': 3, 'B': 4, 'C': 5 },
  'S':  { 'S': 1,  'A': 2, 'B': 3, 'C': 4 },
  'A':  { 'A': 1,  'B': 2, 'C': 3 },
  'B':  { 'B': 1,  'C': 2 },
  'C':  { 'C': 1 }
};

window.loadTradesBoard = async () => {
  try {
    const q = query(collection(db, "trades"), where("status", "==", "open"));
    const snap = await getDocs(q);
    window.allOpenTrades = [];
    snap.forEach(doc => {
      window.allOpenTrades.push({ id: doc.id, ...doc.data() });
    });
    window.renderTradeBoard();
    window.updateTradeLimitsUI();
  } catch (err) {
    console.error("Erro ao carregar trocas:", err);
  }
};

window.updateTradeLimitsUI = () => {
  const limitCount  = document.getElementById('trade-limit-count');
  const blocker     = document.getElementById('trade-form-blocker');
  const msg         = document.getElementById('trade-form-blocker-msg');
  const tp          = window.getTradePeriod();
  const tradesToday = window.userData.lastTradeDate === tp ? (window.userData.tradesToday || 0) : 0;

  if (limitCount) limitCount.innerText = tradesToday;

  if (blocker) {
    let hasActiveTrade = false;
    if (window.allOpenTrades && window.currentUser) {
      hasActiveTrade = window.allOpenTrades.some(
        t => t.fromUserId === window.currentUser.uid && t.status === 'open'
      );
    }

    if (tradesToday >= 2) {
      blocker.classList.remove('hidden'); blocker.classList.add('flex');
      if (msg) msg.innerText = "Você já concluiu as suas trocas deste período.";
    } else if (hasActiveTrade) {
      blocker.classList.remove('hidden'); blocker.classList.add('flex');
      if (msg) msg.innerText = "Você já tem uma oferta ativa no mural. Cancele-a antes de criar outra.";
    } else {
      blocker.classList.add('hidden'); blocker.classList.remove('flex');
    }
  }
};

window.updateTradeOptions = () => {
  const offerSelect = document.getElementById('trade-offer');
  if (!offerSelect) return;
  const currentOffer = offerSelect.value;
  offerSelect.innerHTML = '<option value="">Selecione uma carta repetida...</option>';

  const inv = window.userData.inventory || {};
  window.cardDatabase.forEach(card => {
    const totalQty = inv[card.id] || 0;
    if (totalQty > 1) {
      const tradableQty = totalQty - 1;
      offerSelect.innerHTML += `<option value="${card.id}">${card.name} (Rank ${card.tier}) - Disponíveis: ${tradableQty}</option>`;
    }
  });
  offerSelect.value = currentOffer;
  if (window.updateRequestTierOptions) window.updateRequestTierOptions();
};

window.updateRequestTierOptions = () => {
  const offerSelect   = document.getElementById('trade-offer');
  const reqTierSelect = document.getElementById('trade-request-tier');
  const offerPreview  = document.getElementById('trade-offer-preview');
  if (!reqTierSelect || !offerPreview || !offerSelect) return;

  const offerId = offerSelect.value;
  if (offerId) {
    const offerCard = window.cardDatabase.find(c => c.id === offerId);
    if (!offerCard) return;
    offerPreview.src = window.GITHUB_RAW_URL + offerCard.img;
    offerPreview.classList.remove('hidden');
    const currentReqTier = reqTierSelect.value;
    reqTierSelect.innerHTML = '<option value="">Selecione a Raridade desejada...</option>';
    reqTierSelect.disabled  = false;
    const ratios = TRADE_RATIOS[offerCard.tier] || {};
    Object.entries(ratios).forEach(([tier, qty]) => {
      const label = qty === 1
        ? `Rank ${tier} — 1x ${tier} por 1x ${offerCard.tier}`
        : `Rank ${tier} — ${qty}x ${tier} por 1x ${offerCard.tier}`;
      reqTierSelect.innerHTML += `<option value="${tier}">${label}</option>`;
    });
    reqTierSelect.value = currentReqTier;
  } else {
    offerPreview.classList.add('hidden');
    reqTierSelect.innerHTML = '<option value="">Primeiro selecione o que vai oferecer...</option>';
    reqTierSelect.disabled  = true;
  }
  if (window.updateTradeRatio) window.updateTradeRatio();
};

window.updateTradeRatio = () => {
  const offerSelect   = document.getElementById('trade-offer');
  const reqTierSelect = document.getElementById('trade-request-tier');
  const infoEl        = document.getElementById('trade-ratio-info');
  if (!infoEl || !offerSelect || !reqTierSelect) return;

  const offerId = offerSelect.value;
  const reqTier = reqTierSelect.value;
  if (!offerId || !reqTier) {
    infoEl.innerText       = "";
    window.currentOfferQty = 1;
    window.currentReqQty   = 1;
    return;
  }
  const offerCard = window.cardDatabase.find(c => c.id === offerId);
  if (!offerCard) return;
  window.currentOfferQty = 1;
  window.currentReqQty   = TRADE_RATIOS[offerCard.tier]?.[reqTier] || 1;
  if (window.currentReqQty === 1) {
    infoEl.innerText = `Você dá 1x [${offerCard.tier}] ⇄ O outro jogador envia 1x [${reqTier}] que não tem.`;
  } else {
    infoEl.innerText = `Você dá 1x [${offerCard.tier}] ⇄ O outro jogador envia ${window.currentReqQty}x [${reqTier}] diferentes que não tem.`;
  }
};

window.currentOfferQty = 1;
window.currentReqQty   = 1;
window.allOpenTrades   = [];

const tradeFormEl = document.getElementById('trade-form');
if (tradeFormEl) {
  tradeFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn     = document.getElementById('btn-create-trade');
    const offerId = document.getElementById('trade-offer')?.value;
    const reqTier = document.getElementById('trade-request-tier')?.value;

    if (!offerId || !reqTier) return window.showMessage("Selecione a carta e a raridade desejada!");

    const inv = window.userData.inventory || {};
    if ((inv[offerId] || 0) < 2) {
      return window.showMessage("Não possui cartas suficientes para criar a oferta e manter 1 cópia.");
    }

    const tp          = window.getTradePeriod();
    const tradesToday = window.userData.lastTradeDate === tp ? (window.userData.tradesToday || 0) : 0;
    if (tradesToday >= 2) return window.showMessage("Você já concluiu as suas trocas neste período.");

    const offerCard    = window.cardDatabase.find(c => c.id === offerId);
    const reqQtyToSave = TRADE_RATIOS[offerCard.tier]?.[reqTier] || 1;

    if (btn) { btn.disabled = true; btn.innerText = "Publicando..."; }

    try {
      // Chama a CF createTrade — ela deduz o inventário e cria o documento
      const token    = await window.currentUser.getIdToken();
      const response = await fetch(
        `${window.CLOUD_FUNCTIONS_URL}/createTrade`,
        {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            offerCardId:     offerId,
            requestTier:     reqTier,
            requestQuantity: reqQtyToSave,
          }),
        }
      );

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || "Erro ao publicar oferta.");
      }

      window.showMessage("Sua oferta foi para o Mural!");
      const offerInput = document.getElementById('trade-offer');
      if (offerInput) offerInput.value = "";
      if (window.updateRequestTierOptions) window.updateRequestTierOptions();
      if (window.loadTradesBoard) await window.loadTradesBoard();

    } catch (err) {
      window.showMessage("Erro ao publicar: " + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = "Publicar Oferta no Mural"; }
    }
  });
}

window.renderTradeBoard = () => {
  const myTradesList = document.getElementById('my-trades-list');
  const globalGrid   = document.getElementById('global-trades-grid');
  if (!myTradesList || !globalGrid) return;
  myTradesList.innerHTML = '';
  globalGrid.innerHTML   = '';
  let myTradesCount = 0, globalTradesCount = 0;

  window.allOpenTrades.sort((a, b) => b.timestamp - a.timestamp).forEach(trade => {
    const offerCard = window.cardDatabase.find(c => c.id === trade.offerCardId);
    if (!offerCard) return;
    const isMyTrade  = trade.fromUserId === window.currentUser.uid;
    const offerQty   = trade.offerQuantity   || 1;
    const requestQty = trade.requestQuantity || 1;

    if (isMyTrade) {
      myTradesCount++;
      myTradesList.innerHTML += `
        <div class="bg-gray-900 p-3 rounded border border-gray-600 flex justify-between items-center text-sm">
          <div class="flex items-center gap-2">
            <span class="text-red-400 font-bold">- ${offerQty}x ${offerCard.name} [${offerCard.tier}]</span>
            <span class="text-gray-500">por</span>
            <span class="text-green-400 font-bold">+ ${requestQty}x Rank ${trade.requestTier}</span>
          </div>
          <button onclick="window.cancelTrade('${trade.id}')" class="text-gray-400 hover:text-red-500 transition" title="Cancelar Oferta">✖</button>
        </div>`;
    }

    globalTradesCount++;
    const myInv              = window.userData.inventory || {};
    const alreadyHaveOffered = (myInv[offerCard.id] || 0) > 0;
    const ratioLabel         = requestQty === 1
      ? `1x [${trade.requestTier}]`
      : `${requestQty}x [${trade.requestTier}] diferentes`;

    let actionBtnHTML = '';
    if (isMyTrade) {
      actionBtnHTML = `<button onclick="window.cancelTrade('${trade.id}')" class="w-full py-2 font-bold text-sm transition bg-red-600 hover:bg-red-500 text-white">Cancelar Minha Oferta</button>`;
    } else if (alreadyHaveOffered) {
      actionBtnHTML = `<button disabled class="w-full py-2 font-bold text-[11px] uppercase transition bg-gray-700 text-gray-400 cursor-not-allowed">Já tem esta carta</button>`;
    } else {
      actionBtnHTML = `<button onclick="window.openAcceptTradeModal('${trade.id}', '${trade.fromUserId}', '${offerCard.id}', '${trade.requestTier}', ${requestQty})" class="w-full py-2 font-bold text-sm transition bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]">Aceitar Troca</button>`;
    }

    globalGrid.innerHTML += `
      <div class="bg-gray-900 rounded-xl border ${isMyTrade ? 'border-green-500 shadow-md shadow-green-900/50' : 'border-gray-600'} overflow-hidden flex flex-col">
        <div class="bg-gray-800 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
          <img src="${trade.fromUserAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" class="w-6 h-6 rounded-full bg-gray-700 border border-gray-500">
          <span class="font-bold text-sm ${isMyTrade ? 'text-green-400' : 'text-gray-200'}">${trade.fromUserName} ${isMyTrade ? '(Você)' : ''}</span>
        </div>
        <div class="p-3 flex justify-between items-center gap-2 flex-grow">
          <div class="w-16 h-20 bg-gray-800 rounded border border-gray-600 flex flex-col justify-center items-center relative overflow-hidden" title="${offerCard.name}">
            <span class="absolute top-0 left-0 bg-gray-900 text-white text-[8px] px-1 font-bold z-10 border-b border-r border-gray-500">R.${offerCard.tier}</span>
            <span class="absolute bottom-0 right-0 bg-red-600 text-white text-[10px] px-1 font-bold rounded-tl z-10">${offerQty}x</span>
            <img src="${window.GITHUB_RAW_URL + offerCard.img}" class="w-full h-full object-cover">
          </div>
          <div class="text-center">
            <span class="text-gray-500 text-[10px] font-bold uppercase leading-tight block">pede</span>
            <span class="text-green-400 text-xs font-black">${ratioLabel}</span>
          </div>
          <div class="w-16 h-20 bg-gray-800 rounded border-2 border-green-500/50 border-dashed flex flex-col justify-center items-center relative overflow-hidden">
            <span class="text-xl font-bold text-green-500/50">?</span>
            <span class="absolute top-0 left-0 bg-gray-900 text-green-400 text-[8px] px-1 font-bold border-b border-r border-green-500/50">R.${trade.requestTier}</span>
            <span class="absolute bottom-0 right-0 bg-green-600 text-white text-[10px] px-1 font-bold rounded-tl z-10">${requestQty}x</span>
          </div>
        </div>
        ${actionBtnHTML}
      </div>`;
  });

  if (myTradesCount === 0)     myTradesList.innerHTML = '<p class="text-sm text-gray-500">Nenhuma oferta ativa no momento.</p>';
  if (globalTradesCount === 0) globalGrid.innerHTML   = '<div class="p-8 text-center text-gray-400 w-full col-span-full">Nenhuma oferta no Mural.</div>';
};

// ── cancelTrade via Cloud Function ────────────────────────────
window.cancelTrade = (tradeId) => {
  window.showMessage("Deseja cancelar esta oferta e recuperar as suas cartas?", true, async () => {
    try {
      const token    = await window.currentUser.getIdToken();
      const response = await fetch(
        `${window.CLOUD_FUNCTIONS_URL}/cancelTrade`,
        {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ tradeId }),
        }
      );
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error?.message || "Erro ao cancelar.");

      window.showMessage("Oferta cancelada e cartas devolvidas ao seu álbum!");
      if (window.loadTradesBoard) await window.loadTradesBoard();
    } catch (e) {
      window.showMessage("Erro ao cancelar: " + e.message);
    }
  });
};

window.openAcceptTradeModal = async (tradeId, fromUserId, offerId, reqTier, reqQty) => {
  try {
    const tp          = window.getTradePeriod();
    const tradesToday = window.userData.lastTradeDate === tp ? (window.userData.tradesToday || 0) : 0;
    if (tradesToday >= 2) return window.showMessage("Você já atingiu o seu limite de trocas neste período.");

    const userASnap = await getDoc(doc(db, "users", fromUserId));
    if (!userASnap.exists()) throw "O criador da oferta não foi encontrado.";
    const invA  = userASnap.data().inventory || {};
    const myInv = window.userData.inventory || {};
    let validCardsForB = [];

    window.cardDatabase.forEach(c => {
      if (c.tier === reqTier && (invA[c.id] || 0) === 0 && (myInv[c.id] || 0) > 1) {
        validCardsForB.push(c);
      }
    });

    if (validCardsForB.length < reqQty) {
      return window.showMessage(
        `Você não possui cartas diferentes suficientes. É necessário ter cópias repetidas de ${reqQty} carta(s) diferente(s) de Rank ${reqTier} que o outro jogador ainda não tenha.`
      );
    }

    window.currentTradeAccept = { tradeId, fromUserId, offerId, reqTier, reqQty, selectedIds: [] };

    const grid = document.getElementById('trade-accept-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const tradeAcceptDesc = document.getElementById('trade-accept-desc');
    if (tradeAcceptDesc) {
      tradeAcceptDesc.innerHTML = `Escolha <strong class="text-white">${reqQty} carta(s)</strong> de Rank <strong class="text-white">${reqTier}</strong> repetidas que você tem e que o outro jogador ainda não possui.`;
    }

    validCardsForB.forEach(c => {
      grid.innerHTML += `
        <div id="accept-card-${c.id}" onclick="window.toggleAcceptCard('${c.id}', '${c.id}')" class="cursor-pointer border-2 border-transparent p-1 rounded bg-gray-800 flex flex-col items-center transition relative shadow-lg hover:border-green-500/50">
          <img src="${window.GITHUB_RAW_URL + c.img}" class="w-16 h-20 sm:w-20 sm:h-28 object-cover pointer-events-none rounded border border-gray-600">
          <span class="text-[9px] sm:text-[11px] mt-1 text-center font-bold truncate w-full text-white pointer-events-none">${c.name}</span>
          <span class="text-[8px] text-gray-400 pointer-events-none">${(myInv[c.id] || 0) - 1} repetida(s)</span>
          <div id="check-${c.id}" class="absolute inset-0 bg-green-500/50 hidden items-center justify-center pointer-events-none rounded">
            <span class="text-white text-3xl font-black drop-shadow-md">✓</span>
          </div>
        </div>`;
    });

    const confirmBtn = document.getElementById('btn-confirm-accept');
    if (confirmBtn) {
      confirmBtn.disabled  = true;
      confirmBtn.innerText = `Confirmar Envio (0/${reqQty})`;
      confirmBtn.onclick   = () => window.confirmAcceptTrade();
    }

    const modal = document.getElementById('trade-accept-modal');
    if (modal) modal.classList.remove('hidden');

  } catch (e) {
    window.showMessage("Erro ao preparar troca: " + e);
  }
};

window.toggleAcceptCard = (cardId, instanceId) => {
  const state = window.currentTradeAccept;
  if (!state) return;
  const el    = document.getElementById(`accept-card-${instanceId}`);
  const check = document.getElementById(`check-${instanceId}`);
  if (!el || !check) return;

  const selectedIndex = state.selectedIds.findIndex(item => item.instanceId === instanceId);
  if (selectedIndex > -1) {
    state.selectedIds.splice(selectedIndex, 1);
    el.classList.remove('border-green-400'); el.classList.add('border-transparent');
    check.classList.remove('flex');          check.classList.add('hidden');
  } else {
    if (state.selectedIds.length >= state.reqQty) return;
    state.selectedIds.push({ cardId, instanceId });
    el.classList.remove('border-transparent'); el.classList.add('border-green-400');
    check.classList.remove('hidden');           check.classList.add('flex');
  }

  const confirmBtn = document.getElementById('btn-confirm-accept');
  if (confirmBtn) {
    const count          = state.selectedIds.length;
    confirmBtn.disabled  = count !== state.reqQty;
    confirmBtn.innerText = `Confirmar Envio (${count}/${state.reqQty})`;
  }
};

// ── confirmAcceptTrade via Cloud Function ─────────────────────
window.confirmAcceptTrade = async () => {
  const state           = window.currentTradeAccept;
  const selectedCardIds = state.selectedIds.map(item => item.cardId);

  const btn = document.getElementById('btn-confirm-accept');
  if (btn) { btn.disabled = true; btn.innerText = "Processando Troca..."; }

  try {
    const token    = await window.currentUser.getIdToken();
    const response = await fetch(
      `${window.CLOUD_FUNCTIONS_URL}/acceptTrade`,
      {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tradeId: state.tradeId, selectedCardIds }),
      }
    );

    const json = await response.json();
    if (!response.ok || json.error) {
      throw new Error(json.error?.message || "Erro ao processar a troca.");
    }

    const modal = document.getElementById('trade-accept-modal');
    if (modal) modal.classList.add('hidden');

    window.showMessage("Troca realizada com sucesso! 🎉");
    if (window.loadTradesBoard) await window.loadTradesBoard();

  } catch (e) {
    window.showMessage("Falha na troca: " + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = "Confirmar Envio"; }
  }
};

// ==========================================
// SISTEMA DE FUSÃO DE CARTAS (UI)
// ==========================================

window.updateFusionOptions = () => {
  const select = document.getElementById('fusion-offer');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">Selecione o Rank para sacrificar...</option>';
  const inv = window.userData.inventory || {};
  let hasOptions = false;

  Object.keys(FUSION_RULES).forEach(tier => {
    const rule = FUSION_RULES[tier];
    let duplicateCount = 0;
    window.cardDatabase.forEach(card => {
      if (card.tier === tier && inv[card.id] > 1) duplicateCount += (inv[card.id] - 1);
    });
    if (duplicateCount >= rule.cost) {
      select.innerHTML += `<option value="${tier}">Cartas Rank ${tier} - Custo: ${rule.cost}. Você tem: ${duplicateCount} repetidas</option>`;
      hasOptions = true;
    }
  });

  if (!hasOptions) select.innerHTML = '<option value="">Você não tem cartas repetidas suficientes.</option>';
  select.value = currentVal || '';
  window.updateFusionPreview();
};

window.updateFusionPreview = () => {
  const select           = document.getElementById('fusion-offer');
  const previewContainer = document.getElementById('fusion-preview-container');
  const placeholder      = document.getElementById('fusion-preview-placeholder');
  const costBadge        = document.getElementById('fusion-cost-badge');
  const btn              = document.getElementById('btn-perform-fusion');
  const resultTierText   = document.getElementById('fusion-result-tier-text');
  const resultBox        = document.getElementById('fusion-result-box');
  const errorMsg         = document.getElementById('fusion-error-msg');
  if (!select || !previewContainer) return;

  const tier = select.value;
  if (errorMsg) errorMsg.classList.add('hidden');

  if (tier) {
    const rule = FUSION_RULES[tier];
    previewContainer.classList.remove('hidden');
    if (placeholder) placeholder.classList.add('hidden');
    previewContainer.innerHTML = `
      <div class="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-xl border-4 ${rule.color} shadow-inner">
        <span class="text-6xl font-black ${rule.textColor} drop-shadow-md">${tier}</span>
        <span class="text-xs text-gray-400 mt-3 font-bold uppercase tracking-widest text-center px-2">Cartas<br>Repetidas</span>
      </div>`;
    if (costBadge) { costBadge.innerText = `-${rule.cost} Cópias`; costBadge.classList.remove('hidden'); costBadge.classList.add('flex'); }
    const isDarkBg     = ['S', 'SS'].includes(rule.next);
    const textColorFix = isDarkBg ? 'text-white' : rule.textColor;
    if (resultTierText) {
      resultTierText.innerText = `Nova Carta: Rank ${rule.next}`;
      resultTierText.className = `w-full border rounded-lg px-4 py-3 text-center font-bold shadow-inner ${textColorFix} ${rule.color.replace('border-', 'bg-').replace('400', '900/30')} ${rule.color}`;
    }
    if (resultBox) {
      resultBox.className = `w-40 h-60 bg-gray-900 rounded-xl border-4 border-dashed flex flex-col items-center justify-center relative shadow-[0_0_30px_rgba(255,255,255,0.1)] overflow-hidden ${rule.color}`;
      resultBox.innerHTML = `<div class="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent"></div><span class="text-6xl font-black z-10 drop-shadow-md ${rule.textColor}">?</span>`;
    }
    if (btn) btn.disabled = false;
  } else {
    previewContainer.innerHTML = ''; previewContainer.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (costBadge)   costBadge.classList.add('hidden');
    if (resultTierText) {
      resultTierText.innerText = "Raridade ???";
      resultTierText.className = "w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-center text-gray-400 font-bold shadow-inner";
    }
    if (resultBox) {
      resultBox.className = "w-40 h-60 bg-gray-900 rounded-xl border-2 border-fuchsia-500/50 flex flex-col items-center justify-center relative shadow-[0_0_30px_rgba(217,70,239,0.15)] overflow-hidden";
      resultBox.innerHTML = `<div class="absolute inset-0 bg-gradient-to-t from-fuchsia-900/40 to-transparent"></div><span class="text-6xl text-fuchsia-500/50 font-black z-10 drop-shadow-md">?</span>`;
    }
    if (btn) btn.disabled = true;
  }
};

