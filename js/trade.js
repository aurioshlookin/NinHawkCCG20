// ============================================================
// trade.js — Sistema de Trocas
// ============================================================
    window.loadTradesBoard = async () => {
      try {
        const q = query(collection(db, "trades"), where("status", "==", "open"));
        const snap = await getDocs(q);
        allOpenTrades = [];
        snap.forEach(doc => {
          allOpenTrades.push({ id: doc.id, ...doc.data() });
        });
        window.renderTradeBoard();
        window.updateTradeLimitsUI();
      } catch (err) {
        console.error("Erro ao carregar trocas:", err);
      }
    };

    window.updateTradeLimitsUI = () => {
      const limitCount = document.getElementById('trade-limit-count');
      const blocker = document.getElementById('trade-form-blocker');
      const msg = document.getElementById('trade-form-blocker-msg');
      
      const tp = window.getTradePeriod();
      const tradesToday = userData.lastTradeDate === tp ? (userData.tradesToday || 0) : 0;
      
      if (limitCount) limitCount.innerText = tradesToday;

      if (blocker) {
        let hasActiveTrade = false;
        if (allOpenTrades && currentUser) {
            hasActiveTrade = allOpenTrades.some(t => t.fromUserId === currentUser.uid && t.status === 'open');
        }
        
        if (tradesToday >= 2) {
          blocker.classList.remove('hidden');
          blocker.classList.add('flex');
          if(msg) msg.innerText = "Você já concluiu as suas trocas deste período.";
        } else if (hasActiveTrade) {
          blocker.classList.remove('hidden');
          blocker.classList.add('flex');
          if(msg) msg.innerText = "Você já tem uma oferta ativa no mural. Cancele-a antes de criar outra.";
        } else {
          blocker.classList.add('hidden');
          blocker.classList.remove('flex');
        }
      }
    };

    window.updateTradeOptions = () => {
      const offerSelect = document.getElementById('trade-offer');
      if(!offerSelect) return;
      const currentOffer = offerSelect.value;
      offerSelect.innerHTML = '<option value="">Selecione uma carta repetida...</option>';

      const inv = userData.inventory || {};
      window.cardDatabase.forEach(card => {
        const totalQty = inv[card.id] || 0;
        if (totalQty > 1) {
          const tradableQty = totalQty - 1; 
          offerSelect.innerHTML += `<option value="${card.id}">${card.name} (Rank ${card.tier}) - Disponíveis: ${tradableQty}</option>`;
        }
      });
      offerSelect.value = currentOffer;
      if(window.updateRequestTierOptions) window.updateRequestTierOptions(); 
    };

    window.updateRequestTierOptions = () => {
      const offerSelect = document.getElementById('trade-offer');
      const reqTierSelect = document.getElementById('trade-request-tier');
      const offerPreview = document.getElementById('trade-offer-preview');
      
      if(!reqTierSelect || !offerPreview || !offerSelect) return;
      const offerId = offerSelect.value;

      if (offerId) {
        const offerCard = window.cardDatabase.find(c => c.id === offerId);
        offerPreview.src = GITHUB_RAW_URL + offerCard.img;
        offerPreview.classList.remove('hidden');
        
        const currentReqTier = reqTierSelect.value;
        reqTierSelect.innerHTML = '<option value="">Selecione a Raridade desejada...</option>';
        reqTierSelect.disabled = false;
        
        const offerVal = TIER_VALUES[offerCard.tier];
        
        Object.keys(TIER_VALUES).forEach(tier => {
          if (TIER_VALUES[tier] <= offerVal) {
            reqTierSelect.innerHTML += `<option value="${tier}">Cartas Rank ${tier}</option>`;
          }
        });
        reqTierSelect.value = currentReqTier;
      } else {
        offerPreview.classList.add('hidden');
        reqTierSelect.innerHTML = '<option value="">Primeiro selecione o que vai oferecer...</option>';
        reqTierSelect.disabled = true;
      }
      if(window.updateTradeRatio) window.updateTradeRatio(); 
    };

    window.updateTradeRatio = () => {
      const offerSelect = document.getElementById('trade-offer');
      const reqTierSelect = document.getElementById('trade-request-tier');
      const infoEl = document.getElementById('trade-ratio-info');

      if(!infoEl || !offerSelect || !reqTierSelect) return;
      
      const offerId = offerSelect.value;
      const reqTier = reqTierSelect.value;

      if(!offerId || !reqTier) {
        infoEl.innerText = "";
        currentOfferQty = 1; currentReqQty = 1;
        return;
      }
      const offerCard = window.cardDatabase.find(c => c.id === offerId);
      const offerVal = TIER_VALUES[offerCard.tier];
      const reqVal = TIER_VALUES[reqTier];
      currentOfferQty = 1; 
      currentReqQty = (offerVal - reqVal) + 1; 
      infoEl.innerText = `Você dá 1x [${offerCard.tier}] ⇄ O outro jogador escolherá ${currentReqQty}x [${reqTier}] que não tem para lhe enviar.`;
    };

    const tradeFormEl = document.getElementById('trade-form');
    if (tradeFormEl) {
      tradeFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-create-trade');
        const offerId = document.getElementById('trade-offer')?.value;
        const reqTier = document.getElementById('trade-request-tier')?.value;

        if(!offerId || !reqTier) return window.showMessage("Selecione a carta e a raridade desejada!");
        const inv = userData.inventory || {};
        if((inv[offerId] || 0) <= currentOfferQty) return window.showMessage("Não possui cartas suficientes para criar a oferta e manter 1 cópia.");

        const tp = window.getTradePeriod();
        const tradesToday = userData.lastTradeDate === tp ? (userData.tradesToday || 0) : 0;
        if (tradesToday >= 2) return window.showMessage("Você já concluiu as suas trocas neste período.");

        if(btn) { btn.disabled = true; btn.innerText = "Publicando..."; }

        try {
          await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await transaction.get(userRef);
            let transInv = userSnap.data().inventory || {};

            if((transInv[offerId] || 0) <= currentOfferQty) throw "Cartas insuficientes no inventário.";

            transInv[offerId] -= currentOfferQty; 
            transaction.update(userRef, { inventory: transInv });

            const newTradeRef = doc(collection(db, "trades"));
            transaction.set(newTradeRef, {
              fromUserId: currentUser.uid,
              fromUserName: currentUser.displayName,
              offerCardId: offerId,
              offerQuantity: currentOfferQty,
              requestTier: reqTier,
              requestQuantity: currentReqQty,
              status: 'open',
              timestamp: serverTimestamp()
            });
          });

          window.showMessage("Sua oferta foi para o Mural!");
          const offerInput = document.getElementById('trade-offer');
          if(offerInput) offerInput.value = "";
          if(window.updateRequestTierOptions) window.updateRequestTierOptions();
          
          if(window.loadTradesBoard) await window.loadTradesBoard();
          await window.logSystemAction(`${currentUser.displayName} publicou uma oferta de troca no Mural.`);
        } catch (err) {
          window.showMessage("Erro ao publicar: " + err);
        } finally {
          if(btn) { btn.disabled = false; btn.innerText = "Publicar Oferta no Mural"; }
        }
      });
    }

    window.renderTradeBoard = () => {
      const myTradesList = document.getElementById('my-trades-list');
      const globalGrid = document.getElementById('global-trades-grid');
      if (!myTradesList || !globalGrid) return;

      myTradesList.innerHTML = ''; globalGrid.innerHTML = '';

      let myTradesCount = 0; let globalTradesCount = 0;

      allOpenTrades.sort((a,b) => b.timestamp - a.timestamp).forEach(trade => {
        const offerCard = window.cardDatabase.find(c => c.id === trade.offerCardId);
        if(!offerCard) return;
        const isMyTrade = trade.fromUserId === currentUser.uid;

        if (isMyTrade) {
          myTradesCount++;
          myTradesList.innerHTML += `
            <div class="bg-gray-900 p-3 rounded border border-gray-600 flex justify-between items-center text-sm">
              <div class="flex items-center gap-2">
                <span class="text-red-400 font-bold">- ${trade.offerQuantity || 1}x ${offerCard.name}</span>
                <span class="text-gray-500">por</span>
                <span class="text-green-400 font-bold">+ ${trade.requestQuantity}x Rank ${trade.requestTier}</span>
              </div>
              <button onclick="window.cancelTrade('${trade.id}')" class="text-gray-400 hover:text-red-500 transition" title="Cancelar Oferta">✖</button>
            </div>
          `;
        } 
        
        globalTradesCount++;
        const myInv = userData.inventory || {};
        const alreadyHaveOffered = (myInv[offerCard.id] || 0) > 0;

        let actionBtnHTML = '';
        if (isMyTrade) {
          actionBtnHTML = `<button onclick="window.cancelTrade('${trade.id}')" class="w-full py-2 font-bold text-sm transition bg-red-600 hover:bg-red-500 text-white">Cancelar Minha Oferta</button>`;
        } else if (alreadyHaveOffered) {
          actionBtnHTML = `<button disabled class="w-full py-2 font-bold text-[11px] uppercase transition bg-gray-700 text-gray-400 cursor-not-allowed">Já tem esta carta</button>`;
        } else {
          actionBtnHTML = `<button onclick="window.openAcceptTradeModal('${trade.id}', '${trade.fromUserId}', '${offerCard.id}', '${trade.requestTier}', ${trade.requestQuantity})" class="w-full py-2 font-bold text-sm transition bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]">Aceitar Troca</button>`;
        }

        globalGrid.innerHTML += `
          <div class="bg-gray-900 rounded-xl border ${isMyTrade ? 'border-green-500 shadow-md shadow-green-900/50' : 'border-gray-600'} overflow-hidden flex flex-col">
            <div class="bg-gray-800 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
              <img src="${trade.fromUserAvatar || `https://cdn.discordapp.com/embed/avatars/0.png`}" class="w-6 h-6 rounded-full bg-gray-700 border border-gray-500">
              <span class="font-bold text-sm ${isMyTrade ? 'text-green-400' : 'text-gray-200'}">${trade.fromUserName} ${isMyTrade ? '(Você)' : ''}</span>
            </div>
            <div class="p-3 flex justify-between items-center gap-2 flex-grow">
              <div class="w-16 h-20 bg-gray-800 rounded border border-gray-600 flex flex-col justify-center items-center relative overflow-hidden" title="${offerCard.name}">
                <span class="absolute top-0 left-0 bg-gray-900 text-white text-[8px] px-1 font-bold z-10 border-b border-r border-gray-500">R.${offerCard.tier}</span>
                <span class="absolute bottom-0 right-0 bg-red-600 text-white text-[10px] px-1 font-bold rounded-tl z-10">${trade.offerQuantity || 1}x</span>
                <img src="${GITHUB_RAW_URL + offerCard.img}" class="w-full h-full object-cover">
              </div>
              <span class="text-gray-500 text-[10px] font-bold text-center leading-tight">PEDE EM<br>TROCA</span>
              <div class="w-16 h-20 bg-gray-800 rounded border-2 border-green-500/50 border-dashed flex flex-col justify-center items-center relative overflow-hidden">
                 <span class="text-xl font-bold text-green-500/50">?</span>
                 <span class="absolute top-0 left-0 bg-gray-900 text-green-400 text-[8px] px-1 font-bold border-b border-r border-green-500/50">R.${trade.requestTier}</span>
                 <span class="absolute bottom-0 right-0 bg-green-600 text-white text-[10px] px-1 font-bold rounded-tl z-10">${trade.requestQuantity}x</span>
              </div>
            </div>
            ${actionBtnHTML}
          </div>
        `;
      });

      if(myTradesCount === 0) myTradesList.innerHTML = '<p class="text-sm text-gray-500">Nenhuma oferta ativa no momento.</p>';
      if(globalTradesCount === 0) globalGrid.innerHTML = '<div class="p-8 text-center text-gray-400 w-full col-span-full">Nenhuma oferta no Mural.</div>';
    };

    window.cancelTrade = (tradeId) => {
      window.showMessage("Deseja cancelar esta oferta e recuperar as suas cartas?", true, async () => {
        try {
          await runTransaction(db, async (transaction) => {
            const tradeRef = doc(db, "trades", tradeId);
            const tradeSnap = await transaction.get(tradeRef);
            if (!tradeSnap.exists() || tradeSnap.data().status !== 'open') throw "Esta oferta não está disponível.";
            
            const tradeData = tradeSnap.data();
            if (tradeData.fromUserId !== currentUser.uid) throw "Você não é o dono desta oferta.";

            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await transaction.get(userRef);
            let transInv = userSnap.data().inventory || {};

            transInv[tradeData.offerCardId] = (transInv[tradeData.offerCardId] || 0) + (tradeData.offerQuantity || 1);

            transaction.update(userRef, { inventory: transInv });
            transaction.update(tradeRef, { status: 'cancelled' });
          });
          window.showMessage("Oferta cancelada e cartas devolvidas ao seu álbum!");
          
          if(window.loadTradesBoard) await window.loadTradesBoard();
        } catch (e) {
          window.showMessage("Erro ao cancelar: " + e);
        }
      });
    };

    window.openAcceptTradeModal = async (tradeId, fromUserId, offerId, reqTier, reqQty) => {
      try {
        const tp = window.getTradePeriod();
        const tradesToday = userData.lastTradeDate === tp ? (userData.tradesToday || 0) : 0;
        if (tradesToday >= 2) return window.showMessage("Você já atingiu o seu limite de trocas neste período.");

        const userASnap = await getDoc(doc(db, "users", fromUserId));
        if(!userASnap.exists()) throw "O criador da oferta não foi encontrado.";
        const invA = userASnap.data().inventory || {};

        let validCardsForB = []; 
        const myInv = userData.inventory || {};

        window.cardDatabase.forEach(c => {
          if (c.tier === reqTier && (invA[c.id] || 0) === 0) {
            const myQty = myInv[c.id] || 0;
            if (myQty > 1) { 
              validCardsForB.push(c);
            }
          }
        });

        if (validCardsForB.length < reqQty) {
          return window.showMessage(`Você não possui cartas diferentes suficientes. É necessário ter cópias repetidas de ${reqQty} cartas diferentes de Rank ${reqTier} que o outro jogador ainda não tenha no álbum.`);
        }

        window.currentTradeAccept = { tradeId, fromUserId, offerId, reqTier, reqQty, selectedIds: [] };
        
        const grid = document.getElementById('trade-accept-grid');
        if(!grid) return;
        grid.innerHTML = '';
        
        validCardsForB.forEach(c => {
          const instanceId = c.id; 
          grid.innerHTML += `
            <div id="accept-card-${instanceId}" onclick="window.toggleAcceptCard('${c.id}', '${instanceId}')" class="cursor-pointer border-2 border-transparent p-1 rounded bg-gray-800 flex flex-col items-center transition relative shadow-lg hover:border-green-500/50">
              <img src="${GITHUB_RAW_URL + c.img}" class="w-16 h-20 sm:w-20 sm:h-28 object-cover pointer-events-none rounded border border-gray-600">
              <span class="text-[9px] sm:text-[11px] mt-1 text-center font-bold truncate w-full text-white pointer-events-none">${c.name}</span>
              <div id="check-${instanceId}" class="absolute inset-0 bg-green-500/50 hidden items-center justify-center pointer-events-none rounded">
                <span class="text-white text-3xl font-black drop-shadow-md">✓</span>
              </div>
            </div>
          `;
        });

        const confirmBtn = document.getElementById('btn-confirm-accept');
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.onclick = () => window.confirmAcceptTrade();
        }
        const modal = document.getElementById('trade-accept-modal');
        if(modal) modal.classList.remove('hidden');

      } catch (e) {
        window.showMessage("Erro ao preparar troca: " + e);
      }
    };

    window.toggleAcceptCard = (cardId, instanceId) => {
      const state = window.currentTradeAccept;
      if(!state) return;
      const el = document.getElementById(`accept-card-${instanceId}`);
      const check = document.getElementById(`check-${instanceId}`);
      
      if(!el || !check) return;

      const selectedIndex = state.selectedIds.findIndex(item => item.instanceId === instanceId);

      if (selectedIndex > -1) {
        state.selectedIds.splice(selectedIndex, 1);
        el.classList.remove('border-green-400'); el.classList.add('border-transparent');
        check.classList.remove('flex'); check.classList.add('hidden');
      } else {
        if (state.selectedIds.length >= state.reqQty) return;
        state.selectedIds.push({ cardId, instanceId });
        el.classList.remove('border-transparent'); el.classList.add('border-green-400');
        check.classList.remove('hidden'); check.classList.add('flex');
      }
      const confirmBtn = document.getElementById('btn-confirm-accept');
      if(confirmBtn) confirmBtn.disabled = (state.selectedIds.length !== state.reqQty);
    };

    window.confirmAcceptTrade = async () => {
      const state = window.currentTradeAccept;
      const finalCardsToSend = state.selectedIds.map(item => item.cardId);

      const btn = document.getElementById('btn-confirm-accept');
      if(btn) { btn.disabled = true; btn.innerText = "Processando Troca..."; }

      try {
        await runTransaction(db, async (transaction) => {
          const tradeRef = doc(db, "trades", state.tradeId);
          const userARef = doc(db, "users", state.fromUserId); 
          const userBRef = doc(db, "users", currentUser.uid); 

          const tradeSnap = await transaction.get(tradeRef);
          if (!tradeSnap.exists() || tradeSnap.data().status !== 'open') throw "A troca já foi fechada por outra pessoa.";

          const userASnap = await transaction.get(userARef);
          const userBSnap = await transaction.get(userBRef);

          let invA = userASnap.data().inventory || {}; let invB = userBSnap.data().inventory || {};

          const offQty = tradeSnap.data().offerQuantity || 1;
          const tp = window.getTradePeriod();
          let tradesA = userASnap.data().lastTradeDate === tp ? (userASnap.data().tradesToday || 0) : 0;
          let tradesB = userBSnap.data().lastTradeDate === tp ? (userBSnap.data().tradesToday || 0) : 0;
          
          if (tradesA >= 2) throw "O criador da oferta já atingiu o limite de trocas deste período.";
          if (tradesB >= 2) throw "Você atingiu o seu limite de trocas.";

          let totalTradesA = (userASnap.data().totalTradesCompleted || 0) + 1;
          let totalTradesB = (userBSnap.data().totalTradesCompleted || 0) + 1;

          finalCardsToSend.forEach(id => {
            if((invB[id] || 0) < 1) throw "Inventário insuficiente! Alguém já usou essa carta.";
            invB[id]--; invA[id] = (invA[id] || 0) + 1;
          });

          invB[state.offerId] = (invB[state.offerId] || 0) + offQty;

          const offerCard = window.cardDatabase.find(c => c.id === state.offerId);
          const offerCardName = offerCard ? offerCard.name : "Carta Desconhecida";
          
          const sentNamesCount = {};
          finalCardsToSend.forEach(id => {
            const c = window.cardDatabase.find(card => card.id === id);
            const cName = c ? c.name : "Desconhecida";
            sentNamesCount[cName] = (sentNamesCount[cName] || 0) + 1;
          });
          
          const sentCardNamesString = Object.entries(sentNamesCount)
            .map(([name, count]) => count > 1 ? `${count}x ${name}` : `${name}`)
            .join(", ");

          const newNotif = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type: 'trade_accepted',
            message: `🎉 <strong class="text-green-400">${currentUser.displayName}</strong> aceitou a sua troca! Levou <strong class="text-red-400">${offQty}x ${offerCardName}</strong> e enviou: <strong class="text-yellow-400">${sentCardNamesString}</strong>.`,
            read: false,
            timestamp: Date.now()
          };
          
          let notifsA = userASnap.data().notifications || [];
          notifsA.unshift(newNotif);
          if(notifsA.length > 30) notifsA.pop(); 

          transaction.update(userARef, { inventory: invA, tradesToday: tradesA + 1, lastTradeDate: tp, totalTradesCompleted: totalTradesA, notifications: notifsA });
          transaction.update(userBRef, { inventory: invB, tradesToday: tradesB + 1, lastTradeDate: tp, totalTradesCompleted: totalTradesB });
          transaction.update(tradeRef, { status: 'completed', acceptedBy: currentUser.uid });
        });

        // logGlobalStat de trade — manter ou mover para CF se necessário
        const modal = document.getElementById('trade-accept-modal');
        if(modal) modal.classList.add('hidden');
        window.showMessage("Troca realizada com sucesso!");
        
        if(window.loadTradesBoard) await window.loadTradesBoard();
        await window.logSystemAction(`${currentUser.displayName} concluiu uma troca no Mural.`);
      } catch (e) {
        window.showMessage("Falha na transação. Alguém já pode ter aceitado ou as cartas não estão mais disponíveis.");
      } finally {
        if(btn) { btn.disabled = false; btn.innerText = "Confirmar Envio"; }
      }
    };

    // ==========================================
    // SISTEMA DE FUSÃO DE CARTAS
    // ==========================================

    window.updateFusionOptions = () => {
      const select = document.getElementById('fusion-offer');
      if (!select) return;
      const currentVal = select.value;
      select.innerHTML = '<option value="">Selecione o Rank para sacrificar...</option>';

      const inv = userData.inventory || {};
      let hasOptions = false;

      // Percorre os Ranks e conta quantas "repetidas" o jogador tem no total para aquele Rank
      Object.keys(FUSION_RULES).forEach(tier => {
        const rule = FUSION_RULES[tier];
        let duplicateCount = 0;

        window.cardDatabase.forEach(card => {
          if (card.tier === tier && inv[card.id] > 1) {
             // Se ele tem 3 cópias, 2 são repetidas (podem ser sacrificadas)
             duplicateCount += (inv[card.id] - 1);
          }
        });

        if (duplicateCount >= rule.cost) {
          select.innerHTML += `<option value="${tier}">Cartas Rank ${tier} - Custo: ${rule.cost}. Você tem: ${duplicateCount} repetidas</option>`;
          hasOptions = true;
        }
      });

      if (!hasOptions) {
         select.innerHTML = '<option value="">Você não tem cartas repetidas suficientes.</option>';
      }

      select.value = currentVal || '';
      window.updateFusionPreview();
    };

    window.updateFusionPreview = () => {
      const select = document.getElementById('fusion-offer');
      const previewContainer = document.getElementById('fusion-preview-container');
      const placeholder = document.getElementById('fusion-preview-placeholder');
      const costBadge = document.getElementById('fusion-cost-badge');
      const btn = document.getElementById('btn-perform-fusion');
      const resultTierText = document.getElementById('fusion-result-tier-text');
      const resultBox = document.getElementById('fusion-result-box');
      const errorMsg = document.getElementById('fusion-error-msg');

      if (!select || !previewContainer) return;

      const tier = select.value;
      errorMsg.classList.add('hidden');

      if (tier) {
        const rule = FUSION_RULES[tier];

        previewContainer.classList.remove('hidden');
        placeholder.classList.add('hidden');
        
        // Renderiza um visual genérico de "Múltiplas Cartas" daquele rank
        previewContainer.innerHTML = `
          <div class="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-xl border-4 ${rule.color} shadow-inner">
             <span class="text-6xl font-black ${rule.textColor} drop-shadow-md">${tier}</span>
             <span class="text-xs text-gray-400 mt-3 font-bold uppercase tracking-widest text-center px-2">Cartas<br>Repetidas</span>
          </div>
        `;
        
        costBadge.innerText = `-${rule.cost} Cópias`;
        costBadge.classList.remove('hidden');
        costBadge.classList.add('flex');

        resultTierText.innerText = `Nova Carta: Rank ${rule.next}`;
        resultTierText.className = `w-full border rounded-lg px-4 py-3 text-center font-bold shadow-inner ${rule.textColor} ${rule.color.replace('border-', 'bg-').replace('400', '900/30')} ${rule.color}`;
        
        resultBox.className = `w-40 h-60 bg-gray-900 rounded-xl border-4 border-dashed flex flex-col items-center justify-center relative shadow-[0_0_30px_rgba(255,255,255,0.1)] overflow-hidden ${rule.color}`;
        resultBox.innerHTML = `<div class="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent"></div><span class="text-6xl font-black z-10 drop-shadow-md ${rule.textColor}">?</span>`;

        btn.disabled = false;
      } else {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        costBadge.classList.add('hidden');
        resultTierText.innerText = "Raridade ???";
        resultTierText.className = "w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-center text-gray-400 font-bold shadow-inner";
        resultBox.className = "w-40 h-60 bg-gray-900 rounded-xl border-2 border-fuchsia-500/50 flex flex-col items-center justify-center relative shadow-[0_0_30px_rgba(217,70,239,0.15)] overflow-hidden";
        resultBox.innerHTML = `<div class="absolute inset-0 bg-gradient-to-t from-fuchsia-900/40 to-transparent"></div><span class="text-6xl text-fuchsia-500/50 font-black z-10 drop-shadow-md">?</span>`;
        btn.disabled = true;
      }
    };

