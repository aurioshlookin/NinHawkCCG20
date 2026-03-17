// ============================================================
// community.js — Ranking, leaderboard, busca de jogadores
// BUG-05 FIX: syncLeaderboard() removido daqui.
// O sync agora ocorre dentro da Cloud Function openBasicPack.
// ============================================================
    window.loadAllPlayers = async (forceRefresh = false, silent = false) => {
      const errorEl = document.getElementById('explore-error');
      const loadingEl = document.getElementById('loading-players');
      const tableContainer = document.getElementById('explore-table-container');
      
      if (!silent) {
        if(errorEl) errorEl.classList.add('hidden');
        if(tableContainer) tableContainer.classList.remove('hidden');
        if(loadingEl) loadingEl.classList.remove('hidden');
      }
      
      const now = Date.now();
      const lastFetch = localStorage.getItem('community_fetch_time');
      
      if (!forceRefresh && lastFetch && (now - lastFetch < 2 * 60 * 1000) && window.allPlayersCache.length > 0) {
        if (!silent) {
          window.currentFilteredPlayers = [...window.allPlayersCache];
          window.currentExplorePage = 1;
          window.renderPlayersTable();
        }
        if(!silent && loadingEl) loadingEl.classList.add('hidden');
        return;
      }

      try {
        if (window.currentUser && window.userData && window.userData.role === 'admin' && forceRefresh) {
            const querySnapshot = await getDocs(collection(db, "users"));
            const playersData = {};
            window.allPlayersCache = [];
            querySnapshot.forEach(docSnap => {
               const d = docSnap.data();
               d.inventory = d.inventory || {};
               playersData[docSnap.id] = {
                  displayName: d.displayName,
                  displayNameLower: d.displayNameLower,
                  totalPacksOpened: d.totalPacksOpened || 0,
                  totalTradesCompleted: d.totalTradesCompleted || 0,
                  inventory: d.inventory
               };
               window.allPlayersCache.push({ uid: docSnap.id, ...d });
            });
            await setDoc(doc(db, "community", "leaderboard"), { players: playersData }, { merge: true });
        } else {
            const lbSnap = await getDoc(doc(db, "community", "leaderboard"));
            window.allPlayersCache = [];
            if (lbSnap.exists() && lbSnap.data().players) {
                const pData = lbSnap.data().players;
                Object.keys(pData).forEach(uid => {
                    window.allPlayersCache.push({ uid: uid, ...pData[uid] });
                });
            } else if (!silent) {
                 const querySnapshot = await getDocs(collection(db, "users"));
                 querySnapshot.forEach(docSnap => {
                   let data = docSnap.data();
                   data.inventory = data.inventory || {};
                   window.allPlayersCache.push({ uid: docSnap.id, ...data });
                 });
            }
        }
        
        window.allPlayersCache.sort((a, b) => {
          let stA = 0, stB = 0;
          window.cardDatabase.forEach(c => { if(a.inventory && a.inventory[c.id]>0) stA++; if(b.inventory && b.inventory[c.id]>0) stB++; });
          return stB - stA;
        });
        
        localStorage.setItem('community_fetch_time', now);
        
        if (!silent) {
          window.currentFilteredPlayers = [...window.allPlayersCache];
          window.currentExplorePage = 1;
          window.renderPlayersTable();
        }
      } catch (err) {
        console.error(err);
        if(!silent && errorEl) {
          errorEl.innerText = "Erro ao carregar ranking. Tente novamente.";
          errorEl.classList.remove('hidden');
        }
      } finally {
        if(!silent && loadingEl) loadingEl.classList.add('hidden');
      }
    };

    window.renderPlayersTable = () => {
      const players = window.currentFilteredPlayers || [];
      const tbody = document.getElementById('players-table-body');
      const pagContainer = document.getElementById('explore-pagination');
      const pageInfo = document.getElementById('explore-page-info');
      const btnPrev = document.getElementById('btn-prev-page');
      const btnNext = document.getElementById('btn-next-page');

      if(!tbody) return;
      
      tbody.innerHTML = '';
      if (players.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-gray-500">Nenhum ninja encontrado.</td></tr>`; 
        if(pagContainer) pagContainer.classList.add('hidden');
        return; 
      }

      if(pagContainer) pagContainer.classList.remove('hidden');

      const totalPages = Math.ceil(players.length / window.explorePlayersPerPage);
      if (window.currentExplorePage > totalPages) window.currentExplorePage = totalPages;
      if (window.currentExplorePage < 1) window.currentExplorePage = 1;

      if (pageInfo) pageInfo.innerText = `Página ${window.currentExplorePage} de ${totalPages}`;
      if (btnPrev) btnPrev.disabled = window.currentExplorePage === 1;
      if (btnNext) btnNext.disabled = window.currentExplorePage === totalPages;

      const startIndex = (window.currentExplorePage - 1) * window.explorePlayersPerPage;
      const paginatedPlayers = players.slice(startIndex, startIndex + window.explorePlayersPerPage);

      paginatedPlayers.forEach((player, index) => {
        let stats = { Total: 0, C: 0, B: 0, A: 0, S: 0, SS: 0 };
        const inv = player.inventory || {};
        window.cardDatabase.forEach(c => { if(inv[c.id]>0) { stats.Total++; stats[c.tier]++; } });
        
        const medalHTML = window.getUserMedals(inv);
        const packsOpened = player.totalPacksOpened || 0;
        const tradesCompleted = player.totalTradesCompleted || 0;
        
        const rankPos = startIndex + index + 1;
        let rankMedal = `<span class="text-gray-500 font-black text-sm w-8 text-center bg-gray-900 rounded-lg py-1 border border-gray-700">#${rankPos}</span>`;
        if (rankPos === 1) rankMedal = `<span class="text-yellow-400 font-black text-xl w-8 text-center drop-shadow-md" title="1º Lugar">🥇</span>`;
        if (rankPos === 2) rankMedal = `<span class="text-gray-300 font-black text-xl w-8 text-center drop-shadow-md" title="2º Lugar">🥈</span>`;
        if (rankPos === 3) rankMedal = `<span class="text-orange-400 font-black text-xl w-8 text-center drop-shadow-md" title="3º Lugar">🥉</span>`;

        tbody.innerHTML += `
          <tr class="hover:bg-gray-700 transition duration-150 ease-in-out">
            <td class="p-4 flex items-center gap-3 min-w-[200px]">
              ${rankMedal}
              <img src="${player.avatarUrl || `https://cdn.discordapp.com/embed/avatars/${Math.abs(player.displayName?.charCodeAt(0) || 0) % 5}.png`}" class="w-8 h-8 rounded-full border border-gray-600 bg-gray-800">
              <span class="font-bold text-white">${player.displayName || 'Ninja Oculto'}</span>
              ${medalHTML ? `<div class="ml-1 cursor-help">${medalHTML}</div>` : ''}
            </td>
            <td class="p-4 text-center font-bold text-lg border-r border-gray-700">${stats.Total}</td>
            <td class="p-4 text-center text-green-400 font-semibold">${stats.C}</td>
            <td class="p-4 text-center text-blue-400 font-semibold">${stats.B}</td>
            <td class="p-4 text-center text-purple-400 font-semibold">${stats.A}</td>
            <td class="p-4 text-center text-yellow-400 font-semibold">${stats.S}</td>
            <td class="p-4 text-center text-red-400 font-bold border-r border-gray-700">${stats.SS}</td>
            <td class="p-4 text-center font-bold text-gray-300">${packsOpened}</td>
            <td class="p-4 text-center font-bold text-gray-300">${tradesCompleted}</td>
            <td class="p-4 text-center">
              <button onclick="window.viewPlayerAlbum('${player.uid}')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow">Ver Álbum</button>
            </td>
          </tr>`;
      });
    };

    window.changeExplorePage = (dir) => {
      window.currentExplorePage += dir;
      window.renderPlayersTable();
    };

    window.filterPlayers = () => {
      const inputEl = document.getElementById('search-input');
      const cardInputEl = document.getElementById('search-card-input');
      if(!inputEl || !cardInputEl) return;
      
      const searchVal = inputEl.value.trim().toLowerCase();
      const searchCardVal = cardInputEl.value.trim().toLowerCase();
      
      window.currentFilteredPlayers = window.allPlayersCache.filter(p => {
        const matchesName = !searchVal || (p.displayNameLower && p.displayNameLower.includes(searchVal));
        
        let matchesCard = true;
        if (searchCardVal) {
          matchesCard = false;
          const inv = p.inventory || {};
          for (const cardId in inv) {
            if (inv[cardId] > 0) {
              const cardData = window.cardDatabase.find(c => c.id === cardId);
              if (cardData && cardData.name && cardData.name.toLowerCase().includes(searchCardVal)) {
                matchesCard = true;
                break;
              }
            }
          }
        }
        
        return matchesName && matchesCard;
      });
      
      window.currentExplorePage = 1;
      window.renderPlayersTable();
    };

    window.viewPlayerAlbum = (uid) => {
      const player = window.allPlayersCache.find(p => p.uid === uid);
      if (!player) return;
      
      const container = document.getElementById('explore-table-container');
      const searchArea = document.getElementById('explore-search-area');
      const exploreName = document.getElementById('explore-name');
      const exploreAvatar = document.getElementById('explore-avatar');
      const exploreResults = document.getElementById('explore-results');
      
      if (container) container.classList.add('hidden');
      if (searchArea) searchArea.classList.add('hidden');
      if (exploreName) exploreName.innerText = player.displayName;
      if (exploreAvatar) exploreAvatar.src = `${player.avatarUrl || `https://cdn.discordapp.com/embed/avatars/${Math.abs(player.displayName?.charCodeAt(0) || 0) % 5}.png`}`;
      
      window.currentViewedPlayerInventory = player.inventory || {};
      window.renderAlbumHTML('explore-grid', window.currentViewedPlayerInventory);
      
      if (exploreResults) {
        exploreResults.classList.remove('hidden');
        exploreResults.classList.add('flex');
      }
    };

    window.closePlayerAlbum = () => {
      const exploreResults = document.getElementById('explore-results');
      const exploreTable = document.getElementById('explore-table-container');
      const searchArea = document.getElementById('explore-search-area');
      
      window.currentViewedPlayerInventory = null;

      if (exploreResults) {
        exploreResults.classList.add('hidden');
        exploreResults.classList.remove('flex');
      }
      if (exploreTable) exploreTable.classList.remove('hidden');
      if (searchArea) { searchArea.classList.remove('hidden'); searchArea.classList.add('flex'); }
    };

