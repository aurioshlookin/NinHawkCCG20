// ============================================================
// fusion.js — Sistema de Fusão de Cartas
// ============================================================
    window.performFusion = async () => {
      if (typeof isProcessingPackTransaction !== 'undefined' && isProcessingPackTransaction) return;
      const select = document.getElementById('fusion-offer');
      const btn = document.getElementById('btn-perform-fusion');
      const errorMsg = document.getElementById('fusion-error-msg');
      
      const tier = select.value;
      if (!tier) return;

      const rule = FUSION_RULES[tier];
      if (!rule) return;

      const possibleNextCards = window.cardDatabase.filter(c => c.tier === rule.next);
      if (possibleNextCards.length === 0) {
         errorMsg.innerText = `O sistema não encontrou nenhuma carta Rank ${rule.next} no banco de dados. Fale com os admins!`;
         errorMsg.classList.remove('hidden');
         return;
      }

      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin text-xl">⏳</span> FUNDINDO...`;
      isProcessingPackTransaction = true;

      try {
        const newCard = possibleNextCards[Math.floor(Math.random() * possibleNextCards.length)];

        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await transaction.get(userRef);
          let transInv = userSnap.data().inventory || {};

          // Recalcula as repetidas dentro da transação por segurança
          let dupsAvailable = 0;
          let dupCards = [];
          window.cardDatabase.forEach(c => {
              if (c.tier === tier && transInv[c.id] > 1) {
                  let availableToBurn = transInv[c.id] - 1;
                  dupsAvailable += availableToBurn;
                  dupCards.push({ id: c.id, available: availableToBurn });
              }
          });

          if (dupsAvailable < rule.cost) {
            throw new Error(`Você precisa de ${rule.cost} cartas repetidas Rank ${tier} para realizar a fusão.`);
          }

          // Deduz o custo consumindo as repetidas (de forma justa, iterando sobre as cartas)
          let remainingCost = rule.cost;
          for (let i = 0; i < dupCards.length; i++) {
              if (remainingCost <= 0) break;
              
              let toDeduct = Math.min(dupCards[i].available, remainingCost);
              transInv[dupCards[i].id] -= toDeduct;
              remainingCost -= toDeduct;
          }

          // Adiciona a nova carta
          transInv[newCard.id] = (transInv[newCard.id] || 0) + 1;

          transaction.update(userRef, { inventory: transInv });
        });

        // Sucesso! Animar e mostrar o resultado.
        const modal = document.getElementById('fusion-result-modal');
        const flash = document.getElementById('fusion-result-flash');
        const cardContainer = document.getElementById('fusion-result-card-container');
        const cardContainerInner = document.getElementById('fusion-result-card-inner');
        
        if (window.playGachaSound) window.playGachaSound(newCard.tier);
        if (window.fireConfetti) window.fireConfetti(newCard.tier);

        // Reseta o estado 3D da carta para o verso antes de mostrar
        if (cardContainer) cardContainer.className = 'card-container w-48 h-72 sm:w-64 sm:h-96 transform transition hover:scale-105 rounded-xl z-50';
        if (cardContainerInner) cardContainerInner.classList.remove('flipped');
        
        // Usa o motor original do jogo para montar a frente da carta perfeitamente
        window.renderCardHTML('fusion-result-card-front', newCard, false, false, userData.inventory);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        if (flash) {
          flash.classList.remove('hidden'); void flash.offsetWidth; 
          flash.classList.remove('opacity-0'); flash.classList.add('opacity-100');
          setTimeout(() => {
            flash.classList.remove('opacity-100'); flash.classList.add('opacity-0');
            setTimeout(() => flash.classList.add('hidden'), 300);
          }, 250);
        }

        // Aciona o FLIP 3D e as luzes logo em seguida, igual aos pacotes!
        setTimeout(() => {
            const ringColors = { 'C': 'ring-green-400', 'B': 'ring-blue-400', 'A': 'ring-purple-400', 'S': 'ring-yellow-400', 'SS': 'ring-red-500' };
            if (cardContainer) cardContainer.classList.add(`reveal-${newCard.tier}`, 'ring-4', ringColors[newCard.tier]);
            if (cardContainerInner) cardContainerInner.classList.add('flipped');
        }, 100);

        await window.logSystemAction(`${currentUser.displayName} queimou ${rule.cost}x repetidas [${tier}] e gerou a carta: #${newCard.cardNumber || '000'} ${newCard.name} (Rank ${newCard.tier}) na Fusão.`);

        select.value = '';
        window.updateFusionPreview();

      } catch (err) {
        errorMsg.innerText = err.message;
        errorMsg.classList.remove('hidden');
      } finally {
        isProcessingPackTransaction = false;
        btn.innerHTML = 'REALIZAR RITUAL';
      }
    };

