// ============================================================
// admin.js — Painel Administrativo
// BUG-06 FIX: verificação do PIN agora chama verifyAdminPin()
// Cloud Function em vez de ler admin_security diretamente.
// ============================================================

// ── Carregamento do banco de cartas ───────────────────────────
window.loadCardsCache = async () => {
  try {
    const globalSnap = await getDoc(doc(db, "settings", "global"));
    let currentVersion = Date.now();
    if (globalSnap.exists()) currentVersion = globalSnap.data().cardsVersion;

    const localCards = localStorage.getItem('nin_cards_cache');
    const localVersion = localStorage.getItem('nin_cards_version');

    if (localCards && localVersion == currentVersion) {
      window.cardDatabase = JSON.parse(localCards);
      if (window.updateAllCardDependentUI) window.updateAllCardDependentUI();
    } else {
      const cardsSnap = await getDocs(collection(db, "cards"));
      window.cardDatabase = [];
      cardsSnap.forEach(d => window.cardDatabase.push({ id: d.id, ...d.data() }));
      localStorage.setItem('nin_cards_cache', JSON.stringify(window.cardDatabase));
      localStorage.setItem('nin_cards_version', currentVersion);
      if (window.updateAllCardDependentUI) window.updateAllCardDependentUI();
    }
  } catch (err) { console.error("Erro ao carregar cartas:", err); }
};

// Chama automaticamente quando o módulo carrega
window.loadCardsCache();

window.toggleRegistration = async () => {
  if (!currentUser || userData.role !== 'admin') return;
  const newState = !globalSettings.registrationsOpen;
  try {
    await setDoc(doc(db, "settings", "global"), { registrationsOpen: newState }, { merge: true });
    await window.logSystemAction(`Admin ${currentUser.displayName} ${newState ? 'ATIVOU' : 'DESATIVOU'} os cadastros do servidor.`);
    window.showMessage(newState ? "Cadastros LIGADOS com sucesso." : "Cadastros DESLIGADOS com sucesso.");
  } catch (e) {
    window.showMessage("Erro ao alterar: " + e.message);
  }
};

window.toggleMaintenance = async () => {
  if (!currentUser || userData.role !== 'admin') return;
  const newState = !globalSettings.maintenanceMode;
  try {
    await setDoc(doc(db, "settings", "global"), { maintenanceMode: newState }, { merge: true });
    await window.logSystemAction(`Admin ${currentUser.displayName} ${newState ? 'ATIVOU' : 'DESATIVOU'} o modo manutenção.`);
    window.showMessage(newState ? "Modo Manutenção LIGADO. Os jogadores estão bloqueados." : "Modo Manutenção DESLIGADO.");
  } catch (e) {
    window.showMessage("Erro ao alterar: " + e.message);
  }
};

window.addPacksToUser = async (uid, playerName, type, amount, event) => {
  if (!currentUser || userData.role !== 'admin') return;
  const btn = event.currentTarget;
  const origText = btn.innerText;
  btn.innerText = '...';
  btn.disabled = true;
  try {
    const updateObj = type === 'premium'
      ? { premiumPullsAvailable: increment(amount) }
      : { pullsAvailable: increment(amount) };
    await updateDoc(doc(db, "users", uid), updateObj);
    await window.logSystemAction(`Admin ${currentUser.displayName} ${amount > 0 ? 'adicionou' : 'removeu'} ${Math.abs(amount)} pacotes ${type} do jogador ${playerName}.`);
    await window.loadAdminPlayersLog();
  } catch (err) {
    window.showMessage("Erro ao alterar pacotes: " + err.message);
    btn.innerText = origText;
    btn.disabled = false;
  }
};

window.sendPacksToAll = async (e) => {
  e.preventDefault();
  if (!currentUser || userData.role !== 'admin') return;
  const type = document.getElementById('admin-bulk-type').value;
  const amount = parseInt(document.getElementById('admin-bulk-amount').value);
  const btn = document.getElementById('btn-bulk-packs');
  if (isNaN(amount) || amount <= 0) return window.showMessage("Insira uma quantidade válida.");
  const typeName = type === 'premium' ? 'Premium' : 'Básicos';

  window.showMessage(`Atenção: Vai enviar ${amount} pacotes ${typeName} para TODOS os jogadores registrados. Deseja continuar?`, true, async () => {
    if(btn) { btn.disabled = true; btn.innerText = "Processando Lotes..."; }
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      usersSnap.forEach(docSnap => {
        const updateObj = type === 'premium'
          ? { premiumPullsAvailable: increment(amount) }
          : { pullsAvailable: increment(amount) };
        currentBatch.update(docSnap.ref, updateObj);
        count++;
        if (count === 490) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      });

      if (count > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
      await window.logSystemAction(`Admin ${currentUser.displayName} distribuiu em massa ${amount} pacotes ${typeName} para todos os jogadores.`);
      window.showMessage(`SENSACIONAL! ${amount} pacotes ${typeName} foram enviados para todos os ${usersSnap.docs.length} ninjas!`);
      document.getElementById('admin-bulk-amount').value = '';
      if(window.loadAdminPlayersLog) window.loadAdminPlayersLog();
    } catch (err) {
      window.showMessage("Erro ao enviar pacotes: " + err.message);
    } finally {
      if(btn) { btn.disabled = false; btn.innerText = "Enviar para TODOS"; }
    }
  });
};

window.deleteCard = (id, name) => {
  window.showMessage(`Tem certeza que deseja EXCLUIR permanentemente a carta "${name}"?`, true, async () => {
    try {
      await deleteDoc(doc(db, "cards", id));
      await updateDoc(doc(db, "settings", "global"), { cardsVersion: Date.now() });
      await window.logSystemAction(`Admin ${currentUser.displayName} deletou a carta: ${name}`);
      window.showMessage("Carta excluída com sucesso.");
    } catch (err) {
      window.showMessage("Erro ao excluir carta: " + err.message);
    }
  });
};

window.renumerateCollection = async () => {
  const versionEl = document.getElementById('admin-renum-version');
  if(!versionEl) return;
  const version = versionEl.value;
  const cardsToUpdate = window.cardDatabase.filter(c => c.cardVersion === version);

  if(cardsToUpdate.length === 0) {
    return window.showMessage(`Nenhuma carta encontrada para a coleção ${version}.`);
  }

  window.showMessage(`Isto vai renumerar e ordenar as ${cardsToUpdate.length} cartas da coleção "${version}" automaticamente. Tem certeza?`, true, async () => {
    try {
      cardsToUpdate.sort((a, b) => {
        if (TIER_VALUES[b.tier] !== TIER_VALUES[a.tier]) {
          return TIER_VALUES[b.tier] - TIER_VALUES[a.tier];
        }
        return a.name.localeCompare(b.name);
      });

      const batch = writeBatch(db);
      let count = 1;
      cardsToUpdate.forEach(c => {
        const newNumStr = String(count).padStart(3, '0');
        const cardRef = doc(db, "cards", c.id);
        batch.update(cardRef, { cardNumber: newNumStr });
        count++;
      });

      await batch.commit();
      await updateDoc(doc(db, "settings", "global"), { cardsVersion: Date.now() });
      await window.logSystemAction(`Admin ${currentUser.displayName} renumerou as cartas da coleção: ${version}`);
      window.showMessage(`Numeração da coleção "${version}" aplicada com sucesso!`);
    } catch (err) {
      window.showMessage("Erro ao renumerar: " + err.message);
    }
  });
};

window.loadAdminPlayersLog = async () => {
  const list = document.getElementById('admin-players-list');
  if(!list) return;
  list.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Carregando log...</td></tr>';

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const players = [];
    querySnapshot.forEach(doc => players.push({ uid: doc.id, ...doc.data() }));
    players.sort((a, b) => (b.totalPacksOpened || 0) - (a.totalPacksOpened || 0));

    list.innerHTML = '';
    players.forEach(p => {
      const roleColor = p.role === 'admin' ? 'text-red-400' : 'text-gray-400';
      list.innerHTML += `
        <tr class="hover:bg-gray-700">
          <td class="p-2 font-bold text-white">${p.displayName || 'Desconhecido'}</td>
          <td class="p-2 ${roleColor} font-bold">${p.role === 'admin' ? 'Admin' : 'Jogador'}</td>
          <td class="p-2 text-green-400 font-bold">
            ${p.pullsAvailable || 0}
            <div class="inline-flex gap-1 ml-2">
              <button onclick="window.addPacksToUser('${p.uid}', '${(p.displayName || 'Desconhecido').replace(/'/g, "\\'")}', 'basic', 1, event)" class="bg-green-700 hover:bg-green-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Dar 1 Pacote Básico">+</button>
              <button onclick="window.addPacksToUser('${p.uid}', '${(p.displayName || 'Desconhecido').replace(/'/g, "\\'")}', 'basic', -1, event)" class="bg-red-700 hover:bg-red-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Tirar 1 Pacote Básico">-</button>
            </div>
          </td>
          <td class="p-2 text-yellow-400 font-bold">
            ${p.premiumPullsAvailable || 0}
            <div class="inline-flex gap-1 ml-2">
              <button onclick="window.addPacksToUser('${p.uid}', '${(p.displayName || 'Desconhecido').replace(/'/g, "\\'")}', 'premium', 1, event)" class="bg-green-700 hover:bg-green-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Dar 1 Pacote Premium">+</button>
              <button onclick="window.addPacksToUser('${p.uid}', '${(p.displayName || 'Desconhecido').replace(/'/g, "\\'")}', 'premium', -1, event)" class="bg-red-700 hover:bg-red-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Tirar 1 Pacote Premium">-</button>
            </div>
          </td>
          <td class="p-2 text-blue-400 font-bold">${p.totalPacksOpened || 0}</td>
          <td class="p-2 text-gray-400 text-xs">${p.lastTradeDate || 'Nunca'}</td>
        </tr>
      `;
    });
  } catch (e) {
    list.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-400">Erro: ${e.message}</td></tr>`;
  }
};

// ============================================================
// CORREÇÃO BUG: loadGitHubImages
// Problema original: isFetchingImages travava em true se os
// elementos não existissem; erros de rate limit eram silenciosos.
// ============================================================
let isFetchingImages = false;

window.loadGitHubImages = async () => {
  if (isFetchingImages) return;

  const loading = document.getElementById('github-images-loading');
  const grid = document.getElementById('github-images-grid');
  const emptyMsg = document.getElementById('github-images-empty');

  // Se os elementos do DOM não existem ainda, retorna SEM travar o flag
  if (!loading || !grid || !emptyMsg) return;

  isFetchingImages = true;
  loading.classList.remove('hidden');
  loading.innerText = 'Buscando imagens no GitHub...';
  loading.className = 'text-green-400 text-sm text-center py-2';
  emptyMsg.classList.add('hidden');
  grid.innerHTML = '';

  if (!editingCardId) selectedAdminImage = "";

  try {
    if (!window.cardDatabase) window.cardDatabase = [];

    const apiUrl = 'https://api.github.com/repos/aurioshlookin/NinHawkCCG20/contents/assets/cards';

    // ── OPCIONAL: adicione um GitHub Personal Access Token para aumentar
    //    o rate limit de 60 para 5.000 requisições/hora.
    //    Crie em: github.com → Settings → Developer settings → Fine-grained tokens
    //    Permissão necessária: "Contents" read-only no seu repositório.
    //
    // const GITHUB_TOKEN = 'ghp_SEU_TOKEN_AQUI';
    // const headers = { 'Authorization': `token ${GITHUB_TOKEN}` };
    const headers = {};

    const response = await fetch(apiUrl, { headers });

    // Trata erros de rate limit com mensagem amigável
    if (response.status === 403 || response.status === 429) {
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      const resetTime = rateLimitReset
        ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString('pt-BR')
        : 'em alguns minutos';
      throw new Error(`Rate limit da API do GitHub atingido. Tente novamente às ${resetTime}.`);
    }

    if (!response.ok) throw new Error(`Erro da API GitHub: ${response.status} ${response.statusText}`);

    const files = await response.json();

    const images = files.filter(f =>
      f.type === 'file' &&
      f.name.match(/\.(png|jpg|jpeg|gif)$/i)
    );

    const usedImages = (window.cardDatabase || []).map(c => c.img);

    loading.classList.add('hidden');

    if (images.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }

    images.forEach(file => {
      const isUsed = usedImages.includes(file.name);
      const imgDiv = document.createElement('div');
      imgDiv.className = "cursor-pointer rounded border-2 border-transparent hover:border-green-400 transition overflow-hidden h-24 bg-gray-800 relative group";
      imgDiv.onclick = () => window.selectAdminImage(file.name, imgDiv);

      if (selectedAdminImage === file.name) {
        imgDiv.classList.remove('border-transparent');
        imgDiv.classList.add('border-green-500', 'ring-2', 'ring-green-400');
      }

      imgDiv.innerHTML = `
        <img src="${file.download_url}" class="w-full h-full object-cover group-hover:scale-110 transition duration-300 ${isUsed ? 'opacity-60' : ''}" loading="lazy">
        ${isUsed ? `
          <div class="absolute top-1 right-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
            USADA
          </div>
        ` : ''}
        <div class="absolute bottom-0 left-0 right-0 bg-black/80 text-[10px] text-center truncate px-1 py-0.5 text-white font-semibold">
          ${file.name}
        </div>
      `;
      grid.appendChild(imgDiv);
    });

  } catch (err) {
    console.error('Erro ao carregar imagens do GitHub:', err);
    loading.classList.remove('hidden');
    loading.innerText = `⚠️ ${err.message}`;
    loading.className = 'text-red-400 text-sm text-center py-2 font-bold';
  } finally {
    isFetchingImages = false;
  }
};

window.selectAdminImage = (fileName, element) => {
  selectedAdminImage = fileName;
  const grid = document.getElementById('github-images-grid');
  if(grid) {
    Array.from(grid.children).forEach(child => {
      child.classList.remove('border-green-500', 'ring-2', 'ring-green-400', 'border-transparent');
      child.classList.add('border-transparent');
    });
  }
  if(element) {
    element.classList.remove('border-transparent');
    element.classList.add('border-green-500', 'ring-2', 'ring-green-400');
  }
  if(window.updateAdminPreview) window.updateAdminPreview();
};

window.updateAdminPreview = () => {
  const previewContainer = document.getElementById('admin-preview-container');
  if(!previewContainer) return;

  const adminNameEl = document.getElementById('admin-name');
  const adminCardNumEl = document.getElementById('admin-card-number');
  const adminCardVersionEl = document.getElementById('admin-card-version');
  const adminTierEl = document.getElementById('admin-tier');
  const adminLayoutEl = document.getElementById('admin-layout');
  const adminDescEl = document.getElementById('admin-desc');
  const adminZoomEl = document.getElementById('admin-zoom');
  const adminNameSizeEl = document.getElementById('admin-name-size');
  const adminDescSizeEl = document.getElementById('admin-desc-size');

  const layoutVal = adminLayoutEl ? adminLayoutEl.value : 'standard';

  const tempCard = {
    id: 'preview',
    name: adminNameEl ? adminNameEl.value : 'Nome da Carta',
    cardNumber: adminCardNumEl ? adminCardNumEl.value : '001',
    cardVersion: adminCardVersionEl ? adminCardVersionEl.value : 'Vol. 1',
    tier: adminTierEl ? adminTierEl.value : 'C',
    layout: layoutVal,
    desc: adminDescEl ? adminDescEl.value : 'Descrição...',
    img: selectedAdminImage || '',
    imageZoom: adminZoomEl ? (parseFloat(adminZoomEl.value) || 1) : 1,
    imageTransX: window.adminCardState ? window.adminCardState.transX : 0,
    imageTransY: window.adminCardState ? window.adminCardState.transY : 0,
    nameFontSize: adminNameSizeEl ? (parseInt(adminNameSizeEl.value) || (layoutVal === 'full-art' ? 14 : 12)) : (layoutVal === 'full-art' ? 14 : 12),
    descFontSize: adminDescSizeEl ? (parseInt(adminDescSizeEl.value) || (layoutVal === 'full-art' ? 10 : 9)) : (layoutVal === 'full-art' ? 10 : 9)
  };

  window.renderCardHTML('admin-preview-container', tempCard, false, true, {});
};

window.editCard = (id) => {
  const card = window.cardDatabase.find(c => c.id === id);
  if (!card) return;

  editingCardId = id;

  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) adminNameEl.value = card.name;

  const adminCardNumEl = document.getElementById('admin-card-number');
  if (adminCardNumEl) adminCardNumEl.value = card.cardNumber || '000';

  const versionSelect = document.getElementById('admin-card-version');
  if (versionSelect) {
    const exists = Array.from(versionSelect.options).some(opt => opt.value === card.cardVersion);
    if (!exists && card.cardVersion) {
      const newOption = new Option(card.cardVersion, card.cardVersion);
      versionSelect.add(newOption);
    }
    versionSelect.value = card.cardVersion || 'Vol. 1';
  }

  const tierEl = document.getElementById('admin-tier');
  if (tierEl) tierEl.value = card.tier;

  const layoutEl = document.getElementById('admin-layout');
  if (layoutEl) layoutEl.value = card.layout || 'standard';

  const descEl = document.getElementById('admin-desc');
  if (descEl) descEl.value = card.desc;

  const zoomEl = document.getElementById('admin-zoom');
  if (zoomEl) zoomEl.value = card.imageZoom || 1;

  const nameSizeEl = document.getElementById('admin-name-size');
  if (nameSizeEl) nameSizeEl.value = card.nameFontSize || (card.layout === 'full-art' ? 14 : 12);

  const descSizeEl = document.getElementById('admin-desc-size');
  if (descSizeEl) descSizeEl.value = card.descFontSize || (card.layout === 'full-art' ? 10 : 9);

  window.adminCardState = { transX: card.imageTransX ?? 0, transY: card.imageTransY ?? 0 };
  selectedAdminImage = card.img;

  const submitBtn = document.getElementById('admin-submit');
  if (submitBtn) submitBtn.innerText = "SALVAR ALTERAÇÕES";

  const cancelBtn = document.getElementById('admin-cancel-btn');
  if (cancelBtn) cancelBtn.classList.remove('hidden');

  if(window.updateAdminPreview) window.updateAdminPreview();
  if(window.loadGitHubImages) window.loadGitHubImages();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelEdit = () => {
  editingCardId = null;
  const adminForm = document.getElementById('admin-form');
  if(adminForm) adminForm.reset();

  selectedAdminImage = "";

  const zoomEl = document.getElementById('admin-zoom');
  if (zoomEl) zoomEl.value = 1;

  const nameSizeEl = document.getElementById('admin-name-size');
  if (nameSizeEl) nameSizeEl.value = 12;

  const descSizeEl = document.getElementById('admin-desc-size');
  if (descSizeEl) descSizeEl.value = 9;

  window.adminCardState = { transX: 0, transY: 0 };

  const submitBtn = document.getElementById('admin-submit');
  if (submitBtn) submitBtn.innerText = "CRIAR CARTA E ADICIONAR AO JOGO";

  const cancelBtn = document.getElementById('admin-cancel-btn');
  if (cancelBtn) cancelBtn.classList.add('hidden');

  if(window.suggestNextCardNumber) window.suggestNextCardNumber();
  if(window.updateAdminPreview) window.updateAdminPreview();
  if(window.loadGitHubImages) window.loadGitHubImages();
};

const adminFormGlobal = document.getElementById('admin-form');
if (adminFormGlobal) {
  adminFormGlobal.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('admin-submit');
    const msg = document.getElementById('admin-msg');
    if(!btn || !msg) return;

    if (!selectedAdminImage) {
      msg.innerText = "Erro: Selecione a imagem acima clicando nela!";
      msg.className = "text-center font-bold text-sm mt-2 text-red-400";
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 3000);
      return;
    }

    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
      const adminNameEl = document.getElementById('admin-name');
      const adminCardNumEl = document.getElementById('admin-card-number');
      const adminCardVersionEl = document.getElementById('admin-card-version');
      const adminTierEl = document.getElementById('admin-tier');
      const adminLayoutEl = document.getElementById('admin-layout');
      const adminDescEl = document.getElementById('admin-desc');
      const adminZoomEl = document.getElementById('admin-zoom');
      const adminNameSizeEl = document.getElementById('admin-name-size');
      const adminDescSizeEl = document.getElementById('admin-desc-size');

      const newCard = {
        name: adminNameEl.value,
        cardNumber: adminCardNumEl.value,
        cardVersion: adminCardVersionEl.value,
        tier: adminTierEl.value,
        layout: adminLayoutEl.value,
        desc: adminDescEl.value,
        img: selectedAdminImage,
        imageZoom: parseFloat(adminZoomEl.value) || 1,
        imageTransX: window.adminCardState.transX || 0,
        imageTransY: window.adminCardState.transY || 0,
        nameFontSize: parseInt(adminNameSizeEl.value) || 12,
        descFontSize: parseInt(adminDescSizeEl.value) || 9
      };

      if (editingCardId) {
        await updateDoc(doc(db, "cards", editingCardId), newCard);
        msg.innerText = "Carta editada com sucesso!";
        window.cancelEdit();
      } else {
        await addDoc(collection(db, "cards"), newCard);
        msg.innerText = "Carta criada e adicionada com sucesso!";
        adminFormGlobal.reset();
        window.adminCardState = { transX: 0, transY: 0 };
        selectedAdminImage = "";
        const grid = document.getElementById('github-images-grid');
        if(grid) {
          Array.from(grid.children).forEach(child => child.classList.remove('border-green-500', 'ring-2', 'border-transparent'));
        }
        window.suggestNextCardNumber();
        window.updateAdminPreview();
      }

      await updateDoc(doc(db, "settings", "global"), { cardsVersion: Date.now() });
      await window.logSystemAction(`Admin ${currentUser.displayName} ${editingCardId ? 'editou' : 'criou'} a carta: ${newCard.name} (${newCard.tier})`);

      msg.className = "text-center font-bold text-sm mt-2 text-green-400";
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 3000);

    } catch (error) {
      msg.innerText = "Erro ao processar a carta: " + error.message;
      msg.className = "text-center font-bold text-sm mt-2 text-red-400";
      msg.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerText = editingCardId ? "SALVAR ALTERAÇÕES" : "CRIAR CARTA E ADICIONAR AO JOGO";
    }
  });
}

// --- LÓGICA DO RARITY BOARD (Estatísticas Globais) ---
window.renderRarityBoard = () => {
  const grid = document.getElementById('rarity-grid');
  const totalPlayersSpan = document.getElementById('rarity-total-players');
  if (!grid) return;

  const totalPlayers = window.allPlayersCache.length || 0;
  if (totalPlayersSpan) totalPlayersSpan.innerText = totalPlayers;

  const myInv = (window.userData && window.userData.inventory) ? window.userData.inventory : {};

  const stats = {};
  window.cardDatabase.forEach(c => { stats[c.id] = 0; });

  window.allPlayersCache.forEach(player => {
    const inv = player.inventory || {};
    Object.keys(inv).forEach(id => {
      if (inv[id] > 0 && stats[id] !== undefined) stats[id]++;
    });
  });

  const sortedCards = [...window.cardDatabase].sort((a, b) => {
    const aHave = stats[a.id] || 0;
    const bHave = stats[b.id] || 0;
    if (bHave !== aHave) return bHave - aHave;
    return TIER_VALUES[a.tier] - TIER_VALUES[b.tier];
  });

  grid.innerHTML = '';
  sortedCards.forEach(card => {
    const hasCard = (myInv[card.id] || 0) > 0;
    const ownersCount = stats[card.id] || 0;
    const notOwnersCount = totalPlayers - ownersCount;
    const pct = totalPlayers > 0 ? ((ownersCount / totalPlayers) * 100).toFixed(1) : "0.0";

    const wrapper = document.createElement('div');
    wrapper.className = `flex flex-col items-center p-3 rounded-xl border ${hasCard ? 'bg-gray-800 border-purple-500/30 cursor-pointer' : 'bg-gray-900 border-gray-700 opacity-60 grayscale'} transition hover:opacity-100`;

    if (hasCard) {
      wrapper.onclick = () => window.showCardDetail(card.id);
    }

    const cardDisplayObj = hasCard ? card : { ...card, name: '???', desc: '???' };

    wrapper.innerHTML = `
      <div class="w-full aspect-[2/3] mb-2 pointer-events-none relative rounded-xl overflow-hidden shadow-lg">
        <div id="rarity-card-${card.id}" class="w-full h-full"></div>
      </div>
      <div class="flex flex-col items-center w-full bg-black/40 p-1.5 rounded mt-auto">
        <span class="text-xs font-black text-purple-400">${ownersCount} <span class="text-[9px] font-normal text-gray-400">ninjas têm</span></span>
        <span class="text-[9px] text-gray-500">${pct}% do servidor</span>
      </div>
    `;

    grid.appendChild(wrapper);
    window.renderCardHTML(`rarity-card-${card.id}`, cardDisplayObj, false, true, myInv);
  });
};
