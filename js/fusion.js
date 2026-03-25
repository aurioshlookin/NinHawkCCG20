// ============================================================
// fusion.js — Sistema de Fusão de Cartas
// ============================================================
    window.performFusion = async () => {
      if (typeof isProcessingPackTransaction !== 'undefined' && isProcessingPackTransaction) return;
      const select   = document.getElementById('fusion-offer');
      const btn      = document.getElementById('btn-perform-fusion');
      const errorMsg = document.getElementById('fusion-error-msg');

      const tier = select.value;
      if (!tier) return;

      const rule = FUSION_RULES[tier];
      if (!rule) return;

      // Verificação rápida no cliente (a CF valida novamente)
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
        const token    = await window.currentUser.getIdToken();
        const response = await fetch(
          `${window.CLOUD_FUNCTIONS_URL}/performFusion`,
          {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ tier }),
          }
        );

        const json = await response.json();
        if (!response.ok || json.error) {
          throw new Error(json.error?.message || 'Erro ao realizar fusão.');
        }

        const newCard = json.data.newCard;

        // Animação de resultado
        const modal              = document.getElementById('fusion-result-modal');
        const flash              = document.getElementById('fusion-result-flash');
        const cardContainer      = document.getElementById('fusion-result-card-container');
        const cardContainerInner = document.getElementById('fusion-result-card-inner');

        if (window.playGachaSound) window.playGachaSound(newCard.tier);
        if (window.fireConfetti)   window.fireConfetti(newCard.tier);

        if (cardContainer)      cardContainer.className = 'card-container w-48 h-72 sm:w-64 sm:h-96 transform transition hover:scale-105 rounded-xl z-50';
        if (cardContainerInner) cardContainerInner.classList.remove('flipped');

        window.renderCardHTML('fusion-result-card-front', newCard, false, false, window.userData.inventory);

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

        setTimeout(() => {
          const ringColors = { 'C': 'ring-green-400', 'B': 'ring-blue-400', 'A': 'ring-purple-400', 'S': 'ring-yellow-400', 'SS': 'ring-red-500' };
          if (cardContainer)      cardContainer.classList.add(`reveal-${newCard.tier}`, 'ring-4', ringColors[newCard.tier]);
          if (cardContainerInner) cardContainerInner.classList.add('flipped');
        }, 100);

        select.value = '';
        window.updateFusionPreview();

      } catch (err) {
        if (errorMsg) {
          errorMsg.innerText = err.message;
          errorMsg.classList.remove('hidden');
        }
      } finally {
        isProcessingPackTransaction = false;
        btn.innerHTML = 'REALIZAR RITUAL';
        btn.disabled  = false;
      }
    };

