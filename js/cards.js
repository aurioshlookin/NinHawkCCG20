// ============================================================
// cards.js — Renderização visual de cartas
// ============================================================
    window.renderCardHTML = (elementId, cardData, showQuantity = false, isAlbum = false, sourceInventory = {}) => {
      const container = document.getElementById(elementId);
      if(!container) return;
      
      sourceInventory = sourceInventory || {};
      const quantity = sourceInventory[cardData.id] || 0;
      
      const layout = cardData.layout || 'standard';
      const isFullArt = layout === 'full-art';
      
      const zoom = cardData.imageZoom || 1;
      const transX = cardData.imageTransX ?? 0;
      const transY = cardData.imageTransY ?? 0;
      
      const imgStyle = `width: 100%; height: 100%; object-fit: contain; transform: translate(${transX}px, ${transY}px) scale(${zoom}); transform-origin: center;`;

      const nameFontSize = cardData.nameFontSize ? `${cardData.nameFontSize}px` : (isFullArt ? '14px' : '12px');
      const descFontSize = cardData.descFontSize ? `${cardData.descFontSize}px` : (isFullArt ? '10px' : '9px');
      const nameStyle = `font-size: ${nameFontSize}; line-height: 1.1;`;
      const descStyle = `font-size: ${descFontSize}; line-height: 1.2;`;

      const rankClasses = {
        'C': 'border-green-400 bg-gradient-to-br from-green-900 to-black',
        'B': 'border-blue-400 bg-gradient-to-br from-blue-900 to-black',
        'A': 'border-purple-400 bg-gradient-to-br from-purple-900 to-black',
        'S': 'border-yellow-400 bg-gradient-to-br from-yellow-900 to-black',
        'SS': 'border-red-500 bg-gradient-to-br from-red-900 to-black'
      };
      
      const tierColorText = {
        'C': 'text-green-400', 'B': 'text-blue-400', 'A': 'text-purple-400', 'S': 'text-yellow-400', 'SS': 'text-red-500'
      };

      if (isAlbum) container.className = `w-full h-full rounded-xl border-4 border-solid text-white relative overflow-hidden shadow-inner ${rankClasses[cardData.tier]}`;
      else container.className = `card-front flex flex-col justify-between rounded-xl border-4 border-solid relative overflow-hidden ${rankClasses[cardData.tier]}`;

      const fullImageUrl = cardData.img ? (GITHUB_RAW_URL + cardData.img) : '';
      const collectionText = `${cardData.cardVersion || 'V1'} • #${cardData.cardNumber || '000'}`;

      let foilEffect = '';
      if(cardData.tier === 'S') foilEffect = '<div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent mix-blend-overlay pointer-events-none z-20"></div>';
      if(cardData.tier === 'SS') foilEffect = '<div class="absolute inset-0 foil-anim mix-blend-color-dodge opacity-60 pointer-events-none z-20"></div>';

      let contentHTML = '';

      if(isFullArt) {
        contentHTML = `
          ${foilEffect}
          <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
            <img src="${fullImageUrl}" style="${imgStyle}" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23374151'/%3E%3Ctext x='75' y='80' text-anchor='middle' fill='%236b7280' font-size='11' font-family='sans-serif'%3ESem Imagem%3C/text%3E%3C/svg%3E';">
          </div>
          <div class="absolute top-1 left-1 right-1 z-10 flex justify-between pointer-events-none">
            <span class="font-black text-xs bg-black/80 px-1.5 py-0.5 rounded border border-gray-600 ${tierColorText[cardData.tier]} shadow-md">R.${cardData.tier}</span>
          </div>
          <div class="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none pb-4 sm:pb-5">
            <h3 class="font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]" style="${nameStyle}">${cardData.name}</h3>
            <p class="text-gray-300 italic mt-0.5 leading-tight line-clamp-3" style="${descStyle}">${cardData.desc}</p>
          </div>
          <div class="absolute bottom-1 left-1 z-10 pointer-events-none">
            <span class="text-[7px] sm:text-[9px] text-gray-300 font-bold bg-black/50 px-1 rounded">${collectionText}</span>
          </div>
          ${showQuantity && quantity > 1 ? `<div class="absolute top-1 right-1 bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-green-400 z-40 pointer-events-none">x${quantity}</div>` : ''}
        `;
      } else {
        contentHTML = `
          ${foilEffect}
          <div class="relative z-10 p-1 sm:p-2 h-full flex flex-col pointer-events-none">
            <div class="flex justify-between items-center mb-1">
              <h3 class="font-bold text-white drop-shadow-md truncate max-w-[70%]" style="${nameStyle}">${cardData.name}</h3>
              <span class="font-black text-[10px] sm:text-xs ${tierColorText[cardData.tier]} bg-black/60 px-1 rounded shadow-md">R.${cardData.tier}</span>
            </div>
            
            <div class="w-full aspect-[4/3] bg-black border-2 border-gray-500 overflow-hidden shadow-inner flex-shrink-0 rounded flex items-center justify-center">
              <img src="${fullImageUrl}" style="${imgStyle}" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23374151'/%3E%3Ctext x='75' y='80' text-anchor='middle' fill='%236b7280' font-size='11' font-family='sans-serif'%3ESem Imagem%3C/text%3E%3C/svg%3E';">
            </div>
            
            <div class="flex-grow mt-1 sm:mt-1.5 bg-black/40 p-1 sm:p-1.5 rounded border border-white/20 overflow-hidden text-center flex flex-col items-center justify-center relative">
              <p class="text-gray-200 italic leading-tight line-clamp-4" style="${descStyle}">${cardData.desc}</p>
            </div>
            
            <div class="mt-0.5 text-left pointer-events-none">
              <span class="text-[7px] sm:text-[9px] text-gray-400 font-bold">${collectionText}</span>
            </div>

            ${showQuantity && quantity > 1 ? `<div class="absolute bottom-1 right-1 bg-green-600 text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-green-400 z-40">x${quantity}</div>` : ''}
          </div>
        `;
      }
      container.innerHTML = contentHTML;
    };

    window.showCardDetail = (cardId) => {
      if (!window.cardDatabase) return;
      const card = window.cardDatabase.find(c => c.id === cardId);
      if(!card) return;

      window.playCardClickSound(card.tier);
      
      const dropRates = { 'C': '56.0%', 'B': '30.0%', 'A': '10.3%', 'S': '3.5%', 'SS': '0.2%' };
      const tierColors = { 'C': 'text-green-400 border-green-400', 'B': 'text-blue-400 border-blue-400', 'A': 'text-purple-400 border-purple-400', 'S': 'text-yellow-400 border-yellow-400', 'SS': 'text-red-500 border-red-500' };
      
      const detailName = document.getElementById('detail-card-name');
      const detailDesc = document.getElementById('detail-card-desc');
      const tierEl = document.getElementById('detail-card-tier');
      const chanceEl = document.getElementById('detail-card-chance');
      
      if (detailName) detailName.innerText = card.name;
      if (detailDesc) detailDesc.innerText = card.desc;
      
      if (tierEl) {
        tierEl.innerText = `Rank ${card.tier}`;
        tierEl.className = `px-3 py-1 font-black text-sm rounded shadow-md border ${tierColors[card.tier]} bg-gray-900`;
      }
      if (chanceEl) chanceEl.innerText = `Chance Drop: ${dropRates[card.tier]}`;
      
      let qty = 0;
      const inv = userData.inventory || {};
      if(userData) { qty = inv[cardId] || 0; }
      
      const ownedEl = document.getElementById('detail-card-owned');
      const ownedContainer = document.getElementById('detail-card-owned-container');
      
      if (ownedEl && ownedContainer) {
        if(qty > 0) {
          ownedEl.innerText = qty;
          ownedContainer.classList.remove('hidden'); ownedContainer.classList.add('flex');
        } else {
          ownedContainer.classList.add('hidden'); ownedContainer.classList.remove('flex');
        }
      }
      
      window.renderCardHTML('detail-card-container', card, false, true, inv);
      const modal = document.getElementById('card-detail-modal');
      if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }
    };

    window.closeCardDetail = () => {
      const modal = document.getElementById('card-detail-modal');
      if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    };

    window.refreshAlbum = () => { window.renderAlbumHTML('album-grid', userData.inventory); };

    window.renderAlbumHTML = (gridId, sourceInventory) => {
      const grid = document.getElementById(gridId);
      if(!grid) return;
      
      sourceInventory = sourceInventory || {};

      const isMyAlbum = gridId === 'album-grid';
      const mode = isMyAlbum ? window.currentAlbumView : 'ranked';
      const sort = isMyAlbum ? window.currentAlbumSort : 'tier-desc';

      let uniqueCards = 0;
      let cardsArray = [...window.cardDatabase];

      if (window.showOnlyOwned) {
        cardsArray = cardsArray.filter(card => (sourceInventory[card.id] || 0) > 0);
      }

      cardsArray.sort((a, b) => {
        const qtyA = sourceInventory[a.id] || 0;
        const qtyB = sourceInventory[b.id] || 0;
        if (sort === 'tier-desc') return TIER_VALUES[b.tier] - TIER_VALUES[a.tier];
        if (sort === 'tier-asc') return TIER_VALUES[a.tier] - TIER_VALUES[b.tier];
        if (sort === 'qty-desc') return qtyB - qtyA;
        if (sort === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
      });

      window.cardDatabase.forEach(card => { if((sourceInventory[card.id] || 0) > 0) uniqueCards++; });

      if (isMyAlbum) {
        const countEl = document.getElementById('collection-count');
        if (countEl) countEl.innerText = uniqueCards;
      }

      grid.innerHTML = '';
      
      if (mode === 'grid') {
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
        cardsArray.forEach(card => {
          const quantity = sourceInventory[card.id] || 0;
          const wrapper = document.createElement('div');
          
          if (quantity > 0) {
            wrapper.className = "w-full aspect-[2/3] relative rounded-xl transition transform hover:scale-105 shadow-lg cursor-pointer";
            wrapper.onclick = () => window.showCardDetail(card.id);
            const innerCard = document.createElement('div');
            innerCard.id = `card-${gridId}-${card.id}`;
            innerCard.className = "w-full h-full";
            wrapper.appendChild(innerCard);
            grid.appendChild(wrapper);
            window.renderCardHTML(innerCard.id, card, true, true, sourceInventory);
          } else {
            wrapper.className = "w-full aspect-[2/3] relative rounded-xl transition shadow-lg bg-gray-800 border-2 border-gray-700 flex items-center justify-center opacity-50";
            wrapper.innerHTML = `<span class="text-gray-500 font-bold text-xl">?</span>`;
            grid.appendChild(wrapper);
          }
        });
      } else if (mode === 'table') {
        grid.className = 'w-full overflow-x-auto bg-gray-800 rounded-xl border border-gray-700';
        let tableHTML = `<table class="w-full text-left text-sm whitespace-nowrap"><thead class="bg-gray-900 text-gray-400 border-b border-gray-700"><tr><th class="p-3">Imagem</th><th class="p-3">Carta</th><th class="p-3">Nº</th><th class="p-3">Rank</th><th class="p-3">Descrição</th><th class="p-3 text-center">Quantidade</th></tr></thead><tbody class="divide-y divide-gray-700">`;
        
        cardsArray.forEach(card => {
          const quantity = sourceInventory[card.id] || 0;
          const hasCard = quantity > 0;
          const fullImageUrl = GITHUB_RAW_URL + card.img;
          
          if (hasCard) {
            tableHTML += `<tr class="hover:bg-gray-700 text-white transition duration-150 cursor-pointer" onclick="window.showCardDetail('${card.id}')">
              <td class="p-2"><img src="${fullImageUrl}" class="w-8 h-10 object-cover rounded border border-gray-500"></td>
              <td class="p-3 font-bold">${card.name}</td>
              <td class="p-3 text-gray-400 font-bold">#${card.cardNumber || '000'}</td>
              <td class="p-3 font-bold text-yellow-400">${card.tier}</td>
              <td class="p-3 truncate max-w-[200px]">${card.desc}</td>
              <td class="p-3 text-center font-bold ${quantity > 1 ? 'text-green-400' : ''}">x${quantity}</td>
            </tr>`;
          } else {
            tableHTML += `<tr class="opacity-50 bg-gray-800 text-gray-500 transition duration-150">
              <td class="p-2"><div class="w-8 h-10 bg-gray-700 rounded border border-gray-600 flex items-center justify-center font-bold">?</div></td>
              <td class="p-3 font-bold">???</td>
              <td class="p-3 font-bold">#???</td>
              <td class="p-3 font-bold">${card.tier}</td>
              <td class="p-3">???</td>
              <td class="p-3 text-center font-bold">-</td>
            </tr>`;
          }
        });
        tableHTML += `</tbody></table>`;
        grid.innerHTML = tableHTML;
      } else if (mode === 'ranked') {
        grid.className = 'flex flex-col gap-8 w-full';
        const tierColorText = {
          'C': 'text-green-400 border-green-400/30', 'B': 'text-blue-400 border-blue-400/30', 'A': 'text-purple-400 border-purple-400/30', 'S': 'text-yellow-400 border-yellow-400/30', 'SS': 'text-red-500 border-red-500/30'
        };

        TIER_ORDER.forEach(tier => {
          const cardsInTier = cardsArray.filter(c => c.tier === tier).sort((a,b) => (a.cardNumber || '0').localeCompare(b.cardNumber || '0'));
          if(cardsInTier.length === 0) return;
          
          let tierOwned = 0;
          cardsInTier.forEach(c => { if((sourceInventory[c.id] || 0) > 0) tierOwned++; });
          
          let sectionHTML = `
            <div class="bg-gray-800/50 p-4 rounded-xl border ${tierColorText[tier].split(' ')[1]}">
              <h3 class="text-xl font-bold border-b border-gray-700 pb-2 mb-4 text-white flex justify-between items-center">
                <span class="${tierColorText[tier].split(' ')[0]} uppercase tracking-wider">Rank ${tier}</span>
                <span class="text-sm bg-gray-900 border border-gray-700 px-3 py-1 rounded-full text-gray-400 font-bold">${tierOwned} / ${window.cardDatabase.filter(c=>c.tier===tier).length}</span>
              </h3>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" id="tier-grid-${gridId}-${tier}"></div>
            </div>`;
          grid.insertAdjacentHTML('beforeend', sectionHTML);
          
          const tierGrid = document.getElementById(`tier-grid-${gridId}-${tier}`);
          cardsInTier.forEach(card => {
            const quantity = sourceInventory[card.id] || 0;
            const wrapper = document.createElement('div');
            
            if (quantity > 0) {
              wrapper.className = "w-full aspect-[2/3] relative rounded-xl transition transform hover:scale-105 shadow-lg cursor-pointer";
              wrapper.onclick = () => window.showCardDetail(card.id);
              const innerCard = document.createElement('div');
              innerCard.id = `card-rank-${gridId}-${card.id}`;
              innerCard.className = "w-full h-full";
              wrapper.appendChild(innerCard);
              tierGrid.appendChild(wrapper);
              window.renderCardHTML(innerCard.id, card, true, true, sourceInventory);
            } else {
              wrapper.className = "w-full aspect-[2/3] relative rounded-xl transition shadow-lg bg-gray-800 border-2 border-gray-700 flex items-center justify-center opacity-50";
              wrapper.innerHTML = `<span class="text-gray-500 font-bold text-xl">?</span>`;
              tierGrid.appendChild(wrapper);
            }
          });
        });
      }
    };

