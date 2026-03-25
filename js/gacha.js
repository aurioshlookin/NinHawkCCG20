// ============================================================
// gacha.js — Sistema de Pacotes e Conquistas
// ============================================================

let lastPullsAvailable = null;

    const CLOUD_FUNCTIONS_URL = window.CLOUD_FUNCTIONS_URL || 'https://us-central1-nincardcollectionbr.cloudfunctions.net';

    window.promptOpenPack = (type) => {
      if (!currentUser || isOpeningPack || isProcessingPackTransaction) return;
      
      const modal = document.getElementById('pack-confirm-modal');
      const desc = document.getElementById('pack-confirm-desc');
      const btn = document.getElementById('btn-confirm-open-pack');
      
      if (type === 'basic') {
        if (userData.pullsAvailable <= 0) return;
        desc.innerHTML = `Tem certeza que deseja abrir <strong class="text-green-400">1 Pacote Básico</strong>?<br>Você tem <strong class="text-white">${userData.pullsAvailable}</strong> restantes.`;
        btn.onclick = () => { modal.classList.add('hidden'); window.openPack(); };
      } else {
        if (userData.premiumPullsAvailable <= 0) return;
        desc.innerHTML = `Tem certeza que deseja abrir <strong class="text-yellow-400">1 Pacote Premium</strong>?<br>Você tem <strong class="text-white">${userData.premiumPullsAvailable}</strong> restantes.`;
        btn.onclick = () => { modal.classList.add('hidden'); window.openInventoryPremiumPack(); };
      }
      
      modal.classList.remove('hidden');
    };

    window.openInventoryPremiumPack = async () => {
      if (!currentUser || isProcessingPackTransaction || window.cardDatabase.length === 0) return;
      if ((userData.premiumPullsAvailable || 0) <= 0) return;
      isProcessingPackTransaction = true;
      window.currentAchievType = 'premium';  

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
        window.isOpeningAchiev = true;      

        const overlay = document.getElementById('achiev-pack-overlay');
        const pack = document.getElementById('achiev-booster-pack');
        const revealed = document.getElementById('achiev-revealed-cards');
        const btnClose = document.getElementById('btn-achiev-close');
        const bgPremium = document.getElementById('achiev-pack-bg');
        const iconPremium = document.getElementById('achiev-pack-icon-premium');
        const iconBasic = document.getElementById('achiev-pack-icon-basic');
        const label = document.getElementById('achiev-pack-label');
        const sublabel = document.getElementById('achiev-pack-sublabel');

        // Limpa cartas do overlay anterior
        if (revealed) revealed.innerHTML = '';

        pack.className = 'pack pack-premium glowing-premium cursor-pointer';
        bgPremium.classList.remove('hidden');
        iconPremium.classList.remove('hidden');
        iconBasic.classList.add('hidden');
        label.innerText = "PREMIUM";
        label.className = "block text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10";
        sublabel.innerText = "Pacote Recebido";
        sublabel.className = "block text-xs text-yellow-200 font-bold tracking-widest uppercase bg-black/50 px-2 py-1 rounded z-10";

        pack.classList.remove('hidden', 'tearing');
        revealed.classList.add('hidden');
        btnClose.classList.add('hidden');

        const overlayTitle = document.getElementById('achiev-overlay-title');
        if (overlayTitle) overlayTitle.innerText = "Abra o seu Pacote Premium!";

        overlay.classList.remove('hidden');
        overlay.classList.add('flex');

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

      let highestTierStr = window.currentAchievType === 'premium' ? 'SS' : 'A';
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

          for(let index=0; index<8; index++) {
            revealedContainer.innerHTML += `
              <div class="opacity-0" style="animation: card-deal 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards ${index * 0.12}s;">
                <div class="card-container w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60 cursor-pointer transform transition hover:scale-105 rounded-xl" id="achiev-card-${index}" onclick="window.revealAchievCard(${index})">
                  <div class="card-inner shadow-2xl rounded-xl" id="achiev-card-inner-${index}">
                    <div class="card-back ${window.currentAchievType === 'premium' ? 'border-yellow-400 bg-gradient-to-br from-red-900 to-black' : 'hover:shadow-green-500/50'} transition duration-300 flex flex-col items-center justify-center rounded-xl border-[4px]">
                      <img src="https://raw.githubusercontent.com/aurioshlookin/NinHawkCCG20/main/assets/img/icon.png" class="w-10 h-10 sm:w-16 sm:h-16 opacity-60 drop-shadow-[0_0_5px_rgba(34,197,94,0.4)]" alt="Card Logo">
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
      window.achievSelectedIndices.push(index);  // FIX: window scope

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
    };

    let currentPackCards = [];
    let selectedCardsIndices = [];
    window.isOpeningPack = window.isOpeningPack || false;
    let isProcessingPackTransaction = false;
    // O "|| valor" garante que não sobrescrevem se app.js já inicializou antes.
    window.currentAchievType     = window.currentAchievType     || null;
    window.achievSelectedIndices = window.achievSelectedIndices || [];
    window.isOpeningAchiev       = window.isOpeningAchiev       || false;

    function getRandomCard(isPremium = false) {
      if(window.cardDatabase.length === 0) return null; 
      
      let targetTier = 'C';
      if (isPremium) {
        const roll = Math.floor(Math.random() * 100) + 1;
        targetTier = roll <= 90 ? 'S' : 'SS';
      } else {
        const roll = Math.floor(Math.random() * 10000) + 1;
        if (roll <= 5600) targetTier = 'C';          
        else if (roll <= 8600) targetTier = 'B';     
        else if (roll <= 9630) targetTier = 'A';     
        else if (roll <= 9980) targetTier = 'S';     
        else targetTier = 'SS';                      
      }
      
      let possibleCards = window.cardDatabase.filter(c => c.tier === targetTier);
      if(possibleCards.length === 0 && isPremium) possibleCards = window.cardDatabase.filter(c => c.tier === 'S' || c.tier === 'SS');
      if(possibleCards.length === 0) possibleCards = window.cardDatabase; 
      
      return possibleCards[Math.floor(Math.random() * possibleCards.length)];
    }

    window.openPack = async () => {
      if (!currentUser || isOpeningPack || isProcessingPackTransaction || window.cardDatabase.length === 0) return;
      isProcessingPackTransaction = true;

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${CLOUD_FUNCTIONS_URL}/openBasicPack`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const json = await response.json();
        if (!response.ok || json.error) {
          throw new Error(json.error?.message || 'Erro ao abrir pacote.');
        }

        const { wonCards, missedCards } = json.data;

        // As cartas chegam do servidor — apenas anima no cliente
        window.currentPackWonCards = wonCards;
        window.currentPackMissedCards = missedCards;
        window.packRevealedCount = 0;
        selectedCardsIndices = [];

        const highestTierVal = Math.max(...wonCards.concat(missedCards).map(c => TIER_VALUES[c.tier] || 1));
        const highestTierStr = Object.keys(TIER_VALUES).find(k => TIER_VALUES[k] === highestTierVal) || 'C';

        window.isOpeningPack = true;

        const pack = document.getElementById('booster-pack');
        if (pack) {
          if (highestTierVal >= 4) { pack.classList.add(`glowing-${highestTierStr}`, 'shaking-violent'); }
          else { pack.classList.add('shaking'); }
          window.playGachaSound(highestTierStr);
        }

        const suspenseTime = highestTierVal >= 4 ? 1200 : 400;

        setTimeout(() => {
          if (pack) {
            pack.classList.remove('shaking', 'shaking-violent', 'glowing-SS', 'glowing-S', 'glowing-A');
            pack.classList.add('tearing');
            window.fireConfetti(highestTierStr);
            const flash = document.getElementById('pack-flash');
            if (flash) {
              flash.classList.remove('hidden'); void flash.offsetWidth;
              flash.classList.remove('opacity-0'); flash.classList.add('opacity-100');
              setTimeout(() => {
                flash.classList.remove('opacity-100'); flash.classList.add('opacity-0');
                setTimeout(() => flash.classList.add('hidden'), 300);
              }, 250);
            }
          }
          setTimeout(() => {
            if (pack) { pack.classList.add('hidden'); pack.classList.remove('tearing'); }
            const revealedContainer = document.getElementById('revealed-cards');
            if (revealedContainer) {
              revealedContainer.innerHTML = ''; revealedContainer.classList.remove('hidden');
              for (let index = 0; index < 8; index++) {
                revealedContainer.innerHTML += `
                  <div class="opacity-0" style="animation: card-deal 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards ${index * 0.12}s;">
                    <div class="card-container w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60 cursor-pointer transform transition hover:scale-105 rounded-xl" id="gacha-card-${index}" onclick="window.revealSingleCard(${index})">
                      <div class="card-inner shadow-2xl rounded-xl" id="gacha-card-inner-${index}">
                        <div class="card-back hover:shadow-green-500/50 transition duration-300 flex flex-col items-center justify-center rounded-xl border-[4px]">
                          <img src="https://raw.githubusercontent.com/aurioshlookin/NinHawkCCG20/main/assets/img/icon.png" class="w-10 h-10 sm:w-16 sm:h-16 opacity-60" alt="Card Logo">
                        </div>
                        <div class="card-front p-1 flex flex-col justify-between rounded-xl" id="gacha-card-front-${index}"></div>
                      </div>
                    </div>
                  </div>`;
              }
            }
          }, 400);
        }, suspenseTime);

      } catch (error) {
        window.showMessage("Erro: " + error.message);
      } finally {
        isProcessingPackTransaction = false;
      }
    };

    window.revealSingleCard = async (index) => {
      const innerContainer = document.getElementById(`gacha-card-inner-${index}`);
      if (innerContainer && innerContainer.classList.contains('flipped')) {
        const cardId = innerContainer.getAttribute('data-card-id');
        if (cardId) window.showCardDetail(cardId);
        return;
      }

      if (!innerContainer || selectedCardsIndices.length >= 2) return;

      const cardData = window.currentPackWonCards[window.packRevealedCount];
      window.packRevealedCount++;
      selectedCardsIndices.push(index);

      innerContainer.setAttribute('data-card-id', cardData.id);

      window.playCardClickSound(cardData.tier);

      window.renderCardHTML(`gacha-card-front-${index}`, cardData, false, false, userData.inventory);
      innerContainer.classList.add('flipped');
      
      const cardContainer = document.getElementById(`gacha-card-${index}`);
      if (cardContainer) {
        cardContainer.classList.remove('hover:scale-105');
        const ringColors = { 'C': 'ring-green-400', 'B': 'ring-blue-400', 'A': 'ring-purple-400', 'S': 'ring-yellow-400', 'SS': 'ring-red-500' };
        cardContainer.classList.add(`reveal-${cardData.tier}`, 'ring-4', ringColors[cardData.tier]);
      }
      
      if (selectedCardsIndices.length === 2) {
        setTimeout(() => {
          let missedIndex = 0;
          for(let idx=0; idx<8; idx++) {
            if (!selectedCardsIndices.includes(idx)) {
              const fakeCard = window.currentPackMissedCards[missedIndex++];
              const innerCard = document.getElementById(`gacha-card-inner-${idx}`);
              
              if (innerCard) innerCard.setAttribute('data-card-id', fakeCard.id);

              window.renderCardHTML(`gacha-card-front-${idx}`, fakeCard, false, false, userData.inventory);
              if (innerCard) innerCard.classList.add('flipped');
              
              const leftCardContainer = document.getElementById(`gacha-card-${idx}`);
              if (leftCardContainer) {
                leftCardContainer.classList.add('opacity-70', 'grayscale');
                leftCardContainer.classList.remove('hover:scale-105', 'z-50', 'z-10');
              }
            }
          }
          window.isOpeningPack = false;
          const btnNext = document.getElementById('btn-next');
          if(btnNext) btnNext.classList.remove('hidden');
        }, 1000); 
      }
    };

    window.resetPackArea = () => {
      const revealedCards = document.getElementById('revealed-cards');
      const btnNext = document.getElementById('btn-next');
      if (revealedCards) revealedCards.classList.add('hidden');
      if (btnNext) btnNext.classList.add('hidden');
      window.updateGachaUI(); 
    };

    window.updateGachaUI = () => {
  const currentState = `${userData.pullsAvailable}-${userData.premiumPullsAvailable}`;

if (currentState === lastPullsAvailable) return;
lastPullsAvailable = currentState;
  lastPullsAvailable = userData.pullsAvailable;
            
      const pullsCountEl = document.getElementById('pulls-count');
      if (pullsCountEl) pullsCountEl.innerText = userData.pullsAvailable || 0;
      
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

      if (userData.pullsAvailable <= 0 && !isOpeningPack) {
        if (boosterPack && !boosterPack.classList.contains('hidden')) {
  boosterPack.classList.add('hidden');
}
        if (containerVazio) { if (containerVazio.classList.contains('hidden')) {
  containerVazio.classList.remove('hidden');
  containerVazio.classList.add('flex');
} }
      } else if (!isOpeningPack && window.cardDatabase.length > 0) {
        if (boosterPack && boosterPack.classList.contains('hidden')) {
  boosterPack.classList.remove('hidden');
}
        if (containerVazio) { if (!containerVazio.classList.contains('hidden')) {
  containerVazio.classList.add('hidden');
  containerVazio.classList.remove('flex');
} }
      }
    };
