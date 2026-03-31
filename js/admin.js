// ============================================================
// admin.js — Painel Administrativo
// ============================================================

let editingCardId = null;
let selectedAdminImage = "";

// ── Helper: chama uma CF admin com autenticação ───────────────
async function callAdminCF(endpoint, body) {
  if (!window.currentUser) throw new Error("Não autenticado.");
  const token = await window.currentUser.getIdToken();
  const response = await fetch(`${window.CLOUD_FUNCTIONS_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || json.error || "Erro desconhecido.");
  }
  return json.data;
}

// ── Carregamento do banco de cartas ───────────────────────────
window.loadCardsCache = async () => {
  try {
    const globalSnap = await getDoc(doc(db, "settings", "global"));
    let currentVersion = Date.now();
    if (globalSnap.exists()) currentVersion = globalSnap.data().cardsVersion;

    const localCards   = localStorage.getItem("nin_cards_cache");
    const localVersion = localStorage.getItem("nin_cards_version");

    if (localCards && localVersion == currentVersion) {
      window.cardDatabase = JSON.parse(localCards);
      if (window.updateAllCardDependentUI) window.updateAllCardDependentUI();
    } else {
      const cardsSnap = await getDocs(collection(db, "cards"));
      window.cardDatabase = [];
      cardsSnap.forEach(d => window.cardDatabase.push({ id: d.id, ...d.data() }));
      localStorage.setItem("nin_cards_cache", JSON.stringify(window.cardDatabase));
      localStorage.setItem("nin_cards_version", currentVersion);
      if (window.updateAllCardDependentUI) window.updateAllCardDependentUI();
    }
  } catch (err) { console.error("Erro ao carregar cartas:", err); }
};

// ── Manutenção / Cadastros ────────────────────────────────────

window.toggleRegistration = async () => {
  if (!window.currentUser || window.userData.role !== "admin") return;
  const newState = !window.globalSettings.registrationsOpen;
  try {
    await setDoc(doc(db, "settings", "global"), { registrationsOpen: newState }, { merge: true });
    await window.logSystemAction(`Admin ${window.currentUser.displayName} ${newState ? "ATIVOU" : "DESATIVOU"} os cadastros do servidor.`);
    window.showMessage(newState ? "Cadastros LIGADOS com sucesso." : "Cadastros DESLIGADOS com sucesso.");
  } catch (e) {
    window.showMessage("Erro ao alterar: " + e.message);
  }
};

window.toggleMaintenance = async () => {
  if (!window.currentUser || window.userData.role !== "admin") return;
  const newState = !window.globalSettings.maintenanceMode;
  try {
    await setDoc(doc(db, "settings", "global"), { maintenanceMode: newState }, { merge: true });
    await window.logSystemAction(`Admin ${window.currentUser.displayName} ${newState ? "ATIVOU" : "DESATIVOU"} o modo manutenção.`);
    window.showMessage(newState ? "Modo Manutenção LIGADO." : "Modo Manutenção DESLIGADO.");
  } catch (e) {
    window.showMessage("Erro ao alterar: " + e.message);
  }
};

// ── Dar/remover pacotes de um usuário — via CF ─────────
window.addPacksToUser = async (uid, playerName, type, amount, event) => {
  if (!window.currentUser || window.userData.role !== "admin") return;
  const btn = event.currentTarget;
  const origText = btn.innerText;
  btn.innerText = "...";
  btn.disabled  = true;
  try {
    await callAdminCF("adminAddPacks", { targetUid: uid, type, amount });
    await window.loadAdminPlayersLog();
  } catch (err) {
    window.showMessage("Erro ao alterar pacotes: " + err.message);
    btn.innerText = origText;
    btn.disabled  = false;
  }
};

// ── Enviar pacotes para TODOS — via CF ─────────────────
window.sendPacksToAll = async (e) => {
  e.preventDefault();
  if (!window.currentUser || window.userData.role !== "admin") return;
  const type   = document.getElementById("admin-bulk-type")?.value;
  const amount = parseInt(document.getElementById("admin-bulk-amount")?.value, 10);
  const btn    = document.getElementById("btn-bulk-packs");
  if (isNaN(amount) || amount <= 0) return window.showMessage("Insira uma quantidade válida.");
  const typeName = type === "premium" ? "Premium" : "Básicos";

  window.showMessage(`Vai enviar ${amount} pacotes ${typeName} para TODOS os jogadores. Deseja continuar?`, true, async () => {
    if (btn) { btn.disabled = true; btn.innerText = "Processando..."; }
    try {
      const result = await callAdminCF("adminSendPacksToAll", { type, amount });
      window.showMessage(`${amount} pacotes ${typeName} enviados para ${result.totalAffected} ninjas!`);
      const amtInput = document.getElementById("admin-bulk-amount");
      if (amtInput) amtInput.value = "";
      if (window.loadAdminPlayersLog) window.loadAdminPlayersLog();
    } catch (err) {
      window.showMessage("Erro ao enviar pacotes: " + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = "Enviar para TODOS"; }
    }
  });
};

// ── Excluir carta — via CF ─────────────────────────────
window.deleteCard = (id, name) => {
  window.showMessage(`Tem certeza que deseja EXCLUIR permanentemente a carta "${name}"?`, true, async () => {
    try {
      await callAdminCF("adminDeleteCard", { cardId: id });
      window.showMessage("Carta excluída com sucesso.");
      // Invalida cache local e recarrega
      localStorage.removeItem("nin_cards_cache");
      localStorage.removeItem("nin_cards_version");
      if (window.loadCardsCache) window.loadCardsCache();
    } catch (err) {
      window.showMessage("Erro ao excluir carta: " + err.message);
    }
  });
};

// ── Renumerar coleção — via CF ─────────────────────────
window.renumerateCollection = async () => {
  const versionEl = document.getElementById("admin-renum-version");
  if (!versionEl) return;
  const version = versionEl.value;
  const cardsToUpdate = window.cardDatabase.filter(c => c.cardVersion === version);

  if (cardsToUpdate.length === 0) {
    return window.showMessage(`Nenhuma carta encontrada para a coleção ${version}.`);
  }

  window.showMessage(`Vai renumerar ${cardsToUpdate.length} cartas da coleção "${version}". Tem certeza?`, true, async () => {
    try {
      const result = await callAdminCF("adminRenumerateCollection", { version });
      window.showMessage(`Numeração da coleção "${version}" aplicada para ${result.count} cartas!`);
      localStorage.removeItem("nin_cards_cache");
      localStorage.removeItem("nin_cards_version");
      if (window.loadCardsCache) window.loadCardsCache();
    } catch (err) {
      window.showMessage("Erro ao renumerar: " + err.message);
    }
  });
};

// ── Log de jogadores ────────────────
window.loadAdminPlayersLog = async () => {
  const list = document.getElementById("admin-players-list");
  if (!list) return;
  list.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Carregando log...</td></tr>';

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const players = [];
    querySnapshot.forEach(d => players.push({ uid: d.id, ...d.data() }));
    players.sort((a, b) => (b.totalPacksOpened || 0) - (a.totalPacksOpened || 0));

    list.innerHTML = "";
    players.forEach(p => {
      const roleColor = p.role === "admin" ? "text-red-400" : "text-gray-400";
      const safeName  = (p.displayName || "Desconhecido").replace(/'/g, "\\'");
      const safeDisplayName = DOMPurify.sanitize(p.displayName || "Desconhecido");
      const safeUid         = escAttr(p.uid);
      const safeNameAttr    = escAttr(p.displayName || "Desconhecido");

list.innerHTML += `
  <tr class="hover:bg-gray-700">
    <td class="p-2 font-bold text-white">${safeDisplayName}</td>
    <td class="p-2 ${roleColor} font-bold">${p.role === "admin" ? "Admin" : "Jogador"}</td>
    <td class="p-2 text-green-400 font-bold">
      ${p.pullsAvailable || 0}
      <div class="inline-flex gap-1 ml-2">
        <button onclick="window.addPacksToUser('${safeUid}', '${safeNameAttr}', 'basic', 1, event)" class="bg-green-700 hover:bg-green-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Dar 1 Pacote Básico">+</button>
        <button onclick="window.addPacksToUser('${safeUid}', '${safeNameAttr}', 'basic', -1, event)" class="bg-red-700 hover:bg-red-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Tirar 1 Pacote Básico">-</button>
      </div>
    </td>
    <td class="p-2 text-yellow-400 font-bold">
      ${p.premiumPullsAvailable || 0}
      <div class="inline-flex gap-1 ml-2">
        <button onclick="window.addPacksToUser('${safeUid}', '${safeNameAttr}', 'premium', 1, event)" class="bg-green-700 hover:bg-green-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Dar 1 Pacote Premium">+</button>
        <button onclick="window.addPacksToUser('${safeUid}', '${safeNameAttr}', 'premium', -1, event)" class="bg-red-700 hover:bg-red-600 px-1.5 py-0.5 rounded text-white text-xs leading-none transition" title="Tirar 1 Pacote Premium">-</button>
      </div>
    </td>
    <td class="p-2 text-blue-400 font-bold">${p.totalPacksOpened || 0}</td>
    <td class="p-2 text-gray-400 text-xs">${escAttr(p.lastTradeDate || "Nunca")}</td>
  </tr>
`;
    });
  } catch (e) {
    list.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-400">Erro: ${e.message}</td></tr>`;
  }
};

// ── Imagens do GitHub ─────────────────────────────────────────
let isFetchingImages = false;

window.loadGitHubImages = async () => {
  if (isFetchingImages) return;
  const loading  = document.getElementById("github-images-loading");
  const grid     = document.getElementById("github-images-grid");
  const emptyMsg = document.getElementById("github-images-empty");
  if (!loading || !grid || !emptyMsg) return;

  isFetchingImages = true;
  loading.classList.remove("hidden");
  loading.innerText = "Buscando imagens no GitHub...";
  emptyMsg.classList.add("hidden");

  if (!editingCardId) selectedAdminImage = "";

  try {
    if (!window.cardDatabase) window.cardDatabase = [];
    const response = await fetch("https://api.github.com/repos/aurioshlookin/NinHawkCCG20/contents/assets/cards");
    if (!response.ok) throw new Error(`Erro da API: ${response.status}`);

    const files  = await response.json();
    const images = files.filter(f => f.type === "file" && f.name.match(/\.(png|jpg|jpeg|gif)$/i));
    const usedImages     = (window.cardDatabase || []).map(c => c.img);
    const currentSelected = selectedAdminImage || "";

    grid.innerHTML = "";
    loading.classList.add("hidden");

    if (images.length === 0) { emptyMsg.classList.remove("hidden"); return; }

    images.forEach(file => {
      const isUsed = usedImages.includes(file.name);
      const imgDiv = document.createElement("div");
      imgDiv.className = "cursor-pointer rounded border-2 border-transparent hover:border-green-400 transition overflow-hidden h-24 bg-gray-800 relative group";
      imgDiv.onclick = () => window.selectAdminImage(file.name, imgDiv);

      if (currentSelected === file.name) {
        imgDiv.classList.remove("border-transparent");
        imgDiv.classList.add("border-green-500", "ring-2", "ring-green-400");
      }

      imgDiv.innerHTML = `
        <img src="${file.download_url}" class="w-full h-full object-cover group-hover:scale-110 transition duration-300 ${isUsed ? "opacity-60" : ""}" loading="lazy">
        ${isUsed ? `<div class="absolute top-1 right-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">USADA</div>` : ""}
        <div class="absolute bottom-0 left-0 right-0 bg-black/80 text-[10px] text-center truncate px-1 py-0.5 text-white font-semibold">${file.name}</div>
      `;
      grid.appendChild(imgDiv);
    });
  } catch (err) {
    console.error("Erro ao carregar imagens do GitHub:", err);
    loading.classList.remove("hidden");
    loading.innerText = `⚠️ Erro: ${err.message}`;
    loading.className = "text-red-400 text-sm text-center py-2 font-bold";
  } finally {
    isFetchingImages = false;
  }
};

window.selectAdminImage = (fileName, element) => {
  selectedAdminImage = fileName;
  const grid = document.getElementById("github-images-grid");
  if (grid) {
    Array.from(grid.children).forEach(child => {
      child.classList.remove("border-green-500", "ring-2", "ring-green-400", "border-transparent");
      child.classList.add("border-transparent");
    });
  }
  if (element) {
    element.classList.remove("border-transparent");
    element.classList.add("border-green-500", "ring-2", "ring-green-400");
  }
  if (window.updateAdminPreview) window.updateAdminPreview();
};

// ── Preview do painel admin ───────────────────────────────────
window.updateAdminPreview = () => {
  const previewContainer = document.getElementById("admin-preview-container");
  if (!previewContainer) return;

  const layoutVal = document.getElementById("admin-layout")?.value || "standard";
  const tempCard = {
    id: "preview",
    name:        document.getElementById("admin-name")?.value || "Nome da Carta",
    cardNumber:  document.getElementById("admin-card-number")?.value || "001",
    cardVersion: document.getElementById("admin-card-version")?.value || "Vol. 1",
    tier:        document.getElementById("admin-tier")?.value || "C",
    layout:      layoutVal,
    desc:        document.getElementById("admin-desc")?.value || "Descrição...",
    img:         selectedAdminImage || "",
    imageZoom:   parseFloat(document.getElementById("admin-zoom")?.value) || 1,
    imageTransX: window.adminCardState?.transX || 0,
    imageTransY: window.adminCardState?.transY || 0,
    nameFontSize: parseInt(document.getElementById("admin-name-size")?.value) || (layoutVal === "full-art" ? 14 : 12),
    descFontSize: parseInt(document.getElementById("admin-desc-size")?.value) || (layoutVal === "full-art" ? 10 : 9),
  };

  window.renderCardHTML("admin-preview-container", tempCard, false, true, {});
};

// ── Editar carta ──────────────────────────────────────────────
window.editCard = (id) => {
  const card = window.cardDatabase.find(c => c.id === id);
  if (!card) return;
  editingCardId = id;

  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
  set("admin-name",         card.name);
  set("admin-card-number",  card.cardNumber || "000");
  set("admin-tier",         card.tier);
  set("admin-layout",       card.layout || "standard");
  set("admin-desc",         card.desc);
  set("admin-zoom",         card.imageZoom || 1);
  set("admin-name-size",    card.nameFontSize || (card.layout === "full-art" ? 14 : 12));
  set("admin-desc-size",    card.descFontSize || (card.layout === "full-art" ? 10 : 9));

  const versionSelect = document.getElementById("admin-card-version");
  if (versionSelect) {
    const exists = Array.from(versionSelect.options).some(opt => opt.value === card.cardVersion);
    if (!exists && card.cardVersion) versionSelect.add(new Option(card.cardVersion, card.cardVersion));
    versionSelect.value = card.cardVersion || "Vol. 1";
  }

  window.adminCardState = { transX: card.imageTransX ?? 0, transY: card.imageTransY ?? 0 };
  selectedAdminImage = card.img;

  const submitBtn = document.getElementById("admin-submit");
  if (submitBtn) submitBtn.innerText = "SALVAR ALTERAÇÕES";
  const cancelBtn = document.getElementById("admin-cancel-btn");
  if (cancelBtn) cancelBtn.classList.remove("hidden");

  if (window.updateAdminPreview) window.updateAdminPreview();
  if (window.loadGitHubImages)  window.loadGitHubImages();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.cancelEdit = () => {
  editingCardId      = null;
  selectedAdminImage = "";

  const adminForm = document.getElementById("admin-form");
  if (adminForm) adminForm.reset();

  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
  set("admin-zoom",      1);
  set("admin-name-size", 12);
  set("admin-desc-size", 9);

  window.adminCardState = { transX: 0, transY: 0 };

  const submitBtn = document.getElementById("admin-submit");
  if (submitBtn) submitBtn.innerText = "CRIAR CARTA E ADICIONAR AO JOGO";
  const cancelBtn = document.getElementById("admin-cancel-btn");
  if (cancelBtn) cancelBtn.classList.add("hidden");

  if (window.suggestNextCardNumber) window.suggestNextCardNumber();
  if (window.updateAdminPreview)    window.updateAdminPreview();
  if (window.loadGitHubImages)      window.loadGitHubImages();
};

// ── Formulário de criação/edição — via CF ───────────────
const adminFormGlobal = document.getElementById("admin-form");
if (adminFormGlobal) {
  adminFormGlobal.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("admin-submit");
    const msg = document.getElementById("admin-msg");
    if (!btn || !msg) return;

    if (!selectedAdminImage) {
      msg.innerText = "Erro: Selecione a imagem acima clicando nela!";
      msg.className = "text-center font-bold text-sm mt-2 text-red-400";
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 3000);
      return;
    }

    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
      const layoutVal = document.getElementById("admin-layout")?.value || "standard";
      const cardData = {
        name:        document.getElementById("admin-name")?.value,
        cardNumber:  document.getElementById("admin-card-number")?.value,
        cardVersion: document.getElementById("admin-card-version")?.value,
        tier:        document.getElementById("admin-tier")?.value,
        layout:      layoutVal,
        desc:        document.getElementById("admin-desc")?.value,
        img:         selectedAdminImage,
        imageZoom:   parseFloat(document.getElementById("admin-zoom")?.value) || 1,
        imageTransX: window.adminCardState?.transX || 0,
        imageTransY: window.adminCardState?.transY || 0,
        nameFontSize: parseInt(document.getElementById("admin-name-size")?.value) || 12,
        descFontSize: parseInt(document.getElementById("admin-desc-size")?.value) || 9,
      };

      // Chama a CF — ela valida role no servidor e sanitiza os dados
      await callAdminCF("adminWriteCard", {
        cardId:   editingCardId || undefined,
        cardData,
      });

      msg.innerText = editingCardId ? "Carta editada com sucesso!" : "Carta criada com sucesso!";
      msg.className = "text-center font-bold text-sm mt-2 text-green-400";
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 3000);

      if (editingCardId) {
        window.cancelEdit();
      } else {
        adminFormGlobal.reset();
        window.adminCardState = { transX: 0, transY: 0 };
        selectedAdminImage    = "";
        const grid = document.getElementById("github-images-grid");
        if (grid) Array.from(grid.children).forEach(child => {
          child.classList.remove("border-green-500", "ring-2");
          child.classList.add("border-transparent");
        });
        if (window.suggestNextCardNumber) window.suggestNextCardNumber();
        if (window.updateAdminPreview)    window.updateAdminPreview();
      }

      // Invalida cache e recarrega
      localStorage.removeItem("nin_cards_cache");
      localStorage.removeItem("nin_cards_version");
      if (window.loadCardsCache) window.loadCardsCache();

    } catch (error) {
      msg.innerText = "Erro: " + error.message;
      msg.className = "text-center font-bold text-sm mt-2 text-red-400";
      msg.classList.remove("hidden");
    } finally {
      btn.disabled  = false;
      btn.innerText = editingCardId ? "SALVAR ALTERAÇÕES" : "CRIAR CARTA E ADICIONAR AO JOGO";
    }
  });
}

// ── Rarity Board ──────────────────────────────────────────────
window.renderRarityBoard = () => {
  const grid            = document.getElementById("rarity-grid");
  const totalPlayersSpan = document.getElementById("rarity-total-players");
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

  grid.innerHTML = "";
  sortedCards.forEach(card => {
    const hasCard    = (myInv[card.id] || 0) > 0;
    const ownersCount = stats[card.id] || 0;
    const pct        = totalPlayers > 0 ? ((ownersCount / totalPlayers) * 100).toFixed(1) : "0.0";

    const wrapper = document.createElement("div");
    wrapper.className = `flex flex-col items-center p-3 rounded-xl border ${hasCard ? "bg-gray-800 border-purple-500/30 cursor-pointer" : "bg-gray-900 border-gray-700 opacity-60 grayscale"} transition hover:opacity-100`;

    if (hasCard) wrapper.onclick = () => window.showCardDetail(card.id);

    const cardDisplayObj = hasCard ? card : { ...card, name: "???", desc: "???" };

wrapper.innerHTML = `
  <div class="w-full aspect-[2/3] mb-2 pointer-events-none relative rounded-xl overflow-hidden shadow-lg">
    <div id="rarity-card-${escAttr(card.id)}" class="w-full h-full"></div>
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

