// ============================================================
// gacha.js — Sistema de Pacotes e Conquistas
// ============================================================

let lastPullsAvailable = null;

    const CLOUD_FUNCTIONS_URL = window.CLOUD_FUNCTIONS_URL || 'https://southamerica-east1-nincardcollectionbr.cloudfunctions.net';

    window.promptOpenPack = (type) => {
      if (!currentUser || window.isOpeningAchiev || isProcessingPackTransaction) return;
      
      const modal = document.getElementById('pack-confirm-modal');
      const desc = document.getElementById('pack-confirm-desc');
      const btn = document.getElementById('btn-confirm-open-pack');
      
      if (type === 'basic') {
        if (userData.pullsAvailable <= 0) return;
        desc.innerHTML = `Tem certeza que deseja abrir <strong class="text-green-400">1 Pacote Básico</strong>?<br>Você tem <strong class="text-white">${userData.pullsAvailable}</strong> restantes.`;
        btn.onclick = () => { modal.classList.add('hidden'); window.openPack(); };
      } else if (type === 'iart') {
        if (userData.iartPullsAvailable <= 0) return;
        desc.innerHTML = `Tem certeza que deseja abrir <strong class="text-cyan-400">1 Pacote IArt</strong>?<br>Você tem <strong class="text-white">${userData.iartPullsAvailable}</strong> restantes.`;
        btn.onclick = () => { modal.classList.add('hidden'); window.openIArtPack(); };
      } else {
        if (userData.premiumPullsAvailable <= 0) return;
        desc.innerHTML = `Tem certeza que deseja abrir <strong class="text-yellow-400">1 Pacote Premium</strong>?<br>Você tem <strong class="text-white">${userData.premiumPullsAvailable}</strong> restantes.`;
        btn.onclick = () => { modal.classList.add('hidden'); window.openInventoryPremiumPack(); };
      }
      
      modal.classList.remove('hidden');
    };

    // ── Função Universal para Preparar o Modal (Overlay) ──
    const setupAchievOverlay = (type, titleText, wonCards, missedCards) => {
      const allCards = wonCards.concat(missedCards);
      const highestTierVal = Math.max(...allCards.map(c => TIER_VALUES[c.tier] || 1));
      let highestTierStr = Object.keys(TIER_VALUES).find(k => TIER_VALUES[k] === highestTierVal) || 'C';
      if (type === 'premium') highestTierStr = 'SS'; // Efeito dramático para o Premium

      const overlay = document.getElementById('achiev-pack-overlay');
      const pack = document.getElementById('achiev-booster-pack');
      const revealed = document.getElementById('achiev-revealed-cards');
      const btnClose = document.getElementById('btn-achiev-close');
      const bgPremium = document.getElementById('achiev-pack-bg');
      const iconPremium = document.getElementById('achiev-pack-icon-premium');
      const iconBasic = document.getElementById('achiev-pack-icon-basic');
      const label = document.getElementById('achiev-pack-label');
      const sublabel = document.getElementById('achiev-pack-sublabel');
      const overlayTitle = document.getElementById('achiev-overlay-title');

      if (revealed) revealed.innerHTML = '';

      pack.classList.remove('shaking', 'shaking-violent', 'glowing-SS', 'glowing-S', 'glowing-A', 'glowing-premium');

      if (type === 'premium') {
        pack.className = 'pack pack-premium glowing-premium cursor-pointer';
        bgPremium.classList.remove('hidden');
        iconPremium.classList.remove('hidden');
        iconBasic.classList.add('hidden');
        label.innerText = "PREMIUM";
        label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10";
        sublabel.innerText = "Pacote Especial";
        sublabel.className = "block text-xs text-yellow-200 font-bold tracking-widest uppercase bg-black/50 px-2 py-1 rounded z-10";
      } else if (type === 'iart') {
        pack.className = 'pack pack-iart cursor-pointer';
        bgPremium.classList.add('hidden');
        iconPremium.classList.add('hidden');
        iconBasic.classList.remove('hidden');
        iconBasic.className = "w-24 h-24 flex items-center justify-center drop-shadow-[0_0_15px_rgba(6,182,212,0.6)] z-10";
        label.innerText = "IART";
        label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10";
        sublabel.innerText = "Pacote IArt";
        sublabel.className = "block text-xs text-gray-300 font-bold tracking-widest uppercase z-10";
      } else {
        pack.className = 'pack cursor-pointer';
        bgPremium.classList.add('hidden');
        iconPremium.classList.add('hidden');
        iconBasic.classList.remove('hidden');
        iconBasic.className = "w-24 h-24 flex items-center justify-center drop-shadow-[0_0_15px_rgba(34,197,94,0.6)] z-10";
        label.innerText = "NIN";
        label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-green-300 to-green-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10";
        sublabel.innerText = "Pacote Básico";
        sublabel.className = "block text-xs text-gray-300 font-bold tracking-widest uppercase z-10";
      }

      if (highestTierVal >= 4 && type !== 'premium') { pack.classList.add(`glowing-${highestTierStr}`, 'shaking-violent'); }
      else if (type !== 'premium') { pack.classList.add('shaking'); }

      window.playGachaSound(highestTierStr);

      pack.classList.remove('hidden', 'tearing');
      revealed.classList.add('hidden');
      btnClose.classList.add('hidden');

      if (overlayTitle) {
         overlayTitle.innerText = titleText;
         overlayTitle.classList.add('animate-pulse');
      }

      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    };


    window.openInventoryPremiumPack = async () => {
      if (!currentUser || isProcessingPackTransaction || window.cardDatabase.length === 0) return;
      if ((userData.premiumPullsAvailable || 0) <= 0) return;
      isProcessingPackTransaction = true;

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${CLOUD_FUNCTIONS_URL}/openPremiumPack`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const json = await response.json();
        if (!response.ok || json.error) throw new Error(json.error?.message || 'Erro ao abrir pacote premium.');

        const { wonCards, missedCards } = json.data;
        window.currentAchievWonCards = wonCards;
        window.currentAchievMissedCards = missedCards;
        window.achievRevealedCount = 0;
        window.achievSelectedIndices = [];   
        window.currentAchievType = 'premium';
        window.isOpeningAchiev = true;      

        setupAchievOverlay('premium', "Abra o seu Pacote Premium!", wonCards, missedCards);

      } catch(e) {
        window.showMessage("Erro: " + e.message);
      } finally {
        isProcessingPackTransaction = false;
      }
    };

    window.openIArtPack = async () => {
      if (!currentUser || isProcessingPackTransaction || window.cardDatabase.length === 0) return;
      if ((userData.iartPullsAvailable || 0) <= 0) return;
      isProcessingPackTransaction = true;

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${CLOUD_FUNCTIONS_URL}/openIArtPack`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const json = await response.json();
        if (!response.ok || json.error) throw new Error(json.error?.message || 'Erro ao abrir pacote IArt.');

        const { wonCards, missedCards } = json.data;
        window.currentAchievWonCards = wonCards;
        window.currentAchievMissedCards = missedCards;
        window.achievRevealedCount = 0;
        window.achievSelectedIndices = [];   
        window.currentAchievType = 'iart';
        window.isOpeningAchiev = true;      

        setupAchievOverlay('iart', "Abra o seu Pacote IArt!", wonCards, missedCards);

      } catch(e) {
        window.showMessage("Erro: " + e.message);
      } finally {
        isProcessingPackTransaction = false;
      }
    };

    window.openPack = async () => {
      if (!currentUser || isProcessingPackTransaction || window.cardDatabase.length === 0) return;
      if ((userData.pullsAvailable || 0) <= 0) return;
      isProcessingPackTransaction = true;

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${CLOUD_FUNCTIONS_URL}/openBasicPack`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const json = await response.json();
        if (!response.ok || json.error) throw new Error(json.error?.message || 'Erro ao abrir pacote básico.');

        const { wonCards, missedCards } = json.data;
        window.currentAchievWonCards = wonCards;
        window.currentAchievMissedCards = missedCards;
        window.achievRevealedCount = 0;
        window.achievSelectedIndices = [];   
        window.currentAchievType = 'basic';
        window.isOpeningAchiev = true;      

        setupAchievOverlay('basic', "Abra o seu Pacote!", wonCards, missedCards);

      } catch(e) {
        window.showMessage("Erro: " + e.message);
      } finally {
        isProcessingPackTransaction = false;
      }
    };

    window.triggerAchievPackOpening = () => {
      const pack = document.getElementById('achiev-booster-pack');
      if (!pack || pack.classList.contains('tearing')) return;

      const overlayTitle = document.getElementById('achiev-overlay-title');
      if (overlayTitle) {
        overlayTitle.innerText = "Escolha 2 Cartas!";
        overlayTitle.classList.remove('animate-pulse');
      }

      const allCards = window.currentAchievWonCards.concat(window.currentAchievMissedCards);
      const highestTierVal = Math.max(...allCards.map(c => TIER_VALUES[c.tier] || 1));
      let highestTierStr = Object.keys(TIER_VALUES).find(k => TIER_VALUES[k] === highestTierVal) || 'C';
      if (window.currentAchievType === 'premium') highestTierStr = 'SS';

      window.playGachaSound(highestTierStr);
      pack.classList.add('tearing');
      window.fireConfetti(highestTierStr);
      
      const flash = document.getElementById('achiev-pack-flash');
      if (flash) {
        flash.classList.remove('hidden'); void flash.offsetWidth; 
        flash.classList.remove('opacity-0'); flash.classList.add('opacity-100');
        setTimeout(() => {
          flash.classList.remove('opacity-100'); flash.classList.add('opacity-0');
          setTimeout(() => flash.classList.add('hidden'), 300);
        }, 250);
      }

      setTimeout(() => {
        pack.classList.add('hidden');
        const revealedContainer = document.getElementById('achiev-revealed-cards');
        if (revealedContainer) {
          revealedContainer.innerHTML = '';
          revealedContainer.classList.remove('hidden');

          let cardBackClass = 'hover:shadow-green-500/50 border-gray-600 bg-gray-800'; 
          let iconShadow = 'drop-shadow-[0_0_5px_rgba(34,197,94,0.4)]';
          
          if (window.currentAchievType === 'premium') {
            cardBackClass = 'border-yellow-400 bg-gradient-to-br from-red-900 to-black hover:shadow-yellow-500/50';
            iconShadow = 'drop-shadow-[0_0_5px_rgba(250,204,21,0.4)]';
          } else if (window.currentAchievType === 'iart') {
            cardBackClass = 'border-cyan-500 bg-gradient-to-br from-cyan-900 to-black hover:shadow-cyan-500/50';
            iconShadow = 'drop-shadow-[0_0_5px_rgba(6,182,212,0.4)]';
          }

          for(let index=0; index<8; index++) {
            revealedContainer.innerHTML += `
              <div class="opacity-0" style="animation: card-deal 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards ${index * 0.12}s;">
                <div class="card-container w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60 cursor-pointer transform transition hover:scale-105 rounded-xl" id="achiev-card-${index}" onclick="window.revealAchievCard(${index})">
                  <div class="card-inner shadow-2xl rounded-xl" id="achiev-card-inner-${index}">
                    <div class="card-back ${cardBackClass} transition duration-300 flex flex-col items-center justify-center rounded-xl border-[4px]">
                      <img src="https://raw.githubusercontent.com/aurioshlookin/NinHawkCCG20/main/assets/img/icon.png" class="w-10 h-10 sm:w-16 sm:h-16 opacity-60 ${iconShadow}" alt="Card Logo">
                    </div>
                    <div class="card-front p-1 flex flex-col justify-between rounded-xl" id="achiev-card-front-${index}"></div>
                  </div>
                </div>
              </div>`;
          }
        }
      }, 500);
    };

    window.revealAchievCard = async (index) => {
      const innerContainer = document.getElementById(`achiev-card-inner-${index}`);
      if (innerContainer && innerContainer.classList.contains('flipped')) {
        const cardId = innerContainer.getAttribute('data-card-id');
        if (cardId) window.showCardDetail(cardId);
        return;
      }

      if (!innerContainer || window.achievSelectedIndices.length >= 2) return;

      const cardData = window.currentAchievWonCards[window.achievRevealedCount];
      window.achievRevealedCount++;
      window.achievSelectedIndices.push(index); 

      innerContainer.setAttribute('data-card-id', cardData.id);

      window.playCardClickSound(cardData.tier);

      window.renderCardHTML(`achiev-card-front-${index}`, cardData, false, false, userData.inventory);
      innerContainer.classList.add('flipped');
      
      const cardContainer = document.getElementById(`achiev-card-${index}`);
      if (cardContainer) {
        cardContainer.classList.remove('hover:scale-105');
        const ringColors = { 'C': 'ring-green-400', 'B': 'ring-blue-400', 'A': 'ring-purple-400', 'S': 'ring-yellow-400', 'SS': 'ring-red-500' };
        cardContainer.classList.add(`reveal-${cardData.tier}`, 'ring-4', ringColors[cardData.tier]);
      }
      
      if (window.achievSelectedIndices.length === 2) {
        setTimeout(() => {
          let missedIndex = 0;
          for(let idx=0; idx<8; idx++) {
            if (!window.achievSelectedIndices.includes(idx)) {
              const fakeCard = window.currentAchievMissedCards[missedIndex++];
              const innerCard = document.getElementById(`achiev-card-inner-${idx}`);
              
              if (innerCard) innerCard.setAttribute('data-card-id', fakeCard.id);

              window.renderCardHTML(`achiev-card-front-${idx}`, fakeCard, false, false, userData.inventory);
              if (innerCard) innerCard.classList.add('flipped');
              
              const leftCardContainer = document.getElementById(`achiev-card-${idx}`);
              if (leftCardContainer) {
                leftCardContainer.classList.add('opacity-70', 'grayscale');
                leftCardContainer.classList.remove('hover:scale-105', 'z-50', 'z-10');
              }
            }
          }
          const btnClose = document.getElementById('btn-achiev-close');
          if(btnClose) btnClose.classList.remove('hidden');
        }, 1000); 
      }
    };

    window.closeAchievOverlay = () => {
      const overlay = document.getElementById('achiev-pack-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
      }
      window.isOpeningAchiev = false;
      window.achievSelectedIndices = [];
      window.achievRevealedCount = 0;
      
      // Limpa cache para atualizar imediatamente a mesa do Gacha
      lastPullsAvailable = null;
      window.updateGachaUI();
    };

    let isProcessingPackTransaction = false;
    window.currentAchievType     = window.currentAchievType     || null;
    window.achievSelectedIndices = window.achievSelectedIndices || [];
    window.isOpeningAchiev       = window.isOpeningAchiev       || false;

    window.updateGachaUI = () => {
      const currentState = `${userData.pullsAvailable}-${userData.premiumPullsAvailable}-${userData.iartPullsAvailable}`;

      if (currentState === lastPullsAvailable) return;
      lastPullsAvailable = currentState;
            
      const pullsCountEl = document.getElementById('pulls-count');
      if (pullsCountEl) pullsCountEl.innerText = userData.pullsAvailable || 0;

      const iartPullsCountEl = document.getElementById('iart-pulls-count');
      if (iartPullsCountEl) iartPullsCountEl.innerText = userData.iartPullsAvailable || 0;
      
      const totalOpenedEl = document.getElementById('gacha-total-packs-opened');
      if(totalOpenedEl) totalOpenedEl.innerText = userData.totalPacksOpened || 0;
      
      const totalOpened = userData.totalPacksOpened || 0;
      const claimedTens = userData.claimedAchievements?.tens || 0;
      const maxTens = Math.floor(totalOpened / 10);
      const pendingClaims = maxTens > claimedTens;
      
      let currentProgress = totalOpened % 10;
      if (pendingClaims && currentProgress === 0) currentProgress = 10;
      
      const progressText = document.getElementById('premium-progress-text');
      const progressBar = document.getElementById('premium-progress-bar');
      const claimAlert = document.getElementById('premium-claim-alert');
      
      if (progressText) progressText.innerText = `${currentProgress}/10`;
      if (progressBar) progressBar.style.width = `${(currentProgress / 10) * 100}%`;
      
      if (claimAlert) {
        if (pendingClaims) claimAlert.classList.remove('hidden');
        else claimAlert.classList.add('hidden');
      }
      
      const invPremiumAlert = document.getElementById('inventory-premium-alert');
      const invPremiumCount = document.getElementById('inventory-premium-count');
      if (invPremiumAlert && invPremiumCount) {
        if (userData.premiumPullsAvailable > 0) {
          invPremiumCount.innerText = userData.premiumPullsAvailable;
          invPremiumAlert.classList.remove('hidden');
          invPremiumAlert.classList.add('flex');
        } else {
          invPremiumAlert.classList.add('hidden');
          invPremiumAlert.classList.remove('flex');
        }
      }

      const containerVazio = document.getElementById('out-of-pulls-container');
      const boosterPack = document.getElementById('booster-pack');
      const iartPack = document.getElementById('iart-pack');

      // Visibilidade Booster
      if (userData.pullsAvailable <= 0 && !window.isOpeningAchiev) {
        if (boosterPack && !boosterPack.classList.contains('hidden')) boosterPack.classList.add('hidden');
      } else if (!window.isOpeningAchiev && window.cardDatabase.length > 0) {
        if (boosterPack && boosterPack.classList.contains('hidden')) boosterPack.classList.remove('hidden');
      }

      // Visibilidade IArt
      if (userData.iartPullsAvailable <= 0 && !window.isOpeningAchiev) {
        if (iartPack && !iartPack.classList.contains('hidden')) iartPack.classList.add('hidden');
      } else if (!window.isOpeningAchiev && window.cardDatabase.length > 0) {
        if (iartPack && iartPack.classList.contains('hidden')) iartPack.classList.remove('hidden');
      }

      // Container Vazio (Aparece apenas se os dois pacotes normais estiverem zerados e não estiver abrindo nada)
      if (userData.pullsAvailable <= 0 && userData.iartPullsAvailable <= 0 && !window.isOpeningAchiev) {
        if (containerVazio && containerVazio.classList.contains('hidden')) {
          containerVazio.classList.remove('hidden');
          containerVazio.classList.add('flex');
        }
      } else {
        if (containerVazio && !containerVazio.classList.contains('hidden')) {
          containerVazio.classList.add('hidden');
          containerVazio.classList.remove('flex');
        }
      }
    };