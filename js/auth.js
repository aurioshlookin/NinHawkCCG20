// ============================================================
// auth.js — Autenticação via Discord OAuth2
// Sistema antigo (nick/senha) removido completamente.
// ============================================================
// FLUXO:
//   1. Usuário clica "Entrar com Discord"
//   2. É redirecionado para Discord OAuth (nova aba ou redirect)
//   3. Discord redireciona para discord-callback.html?code=XXX
//   4. discord-callback.html envia o code para a Cloud Function discordAuth
//   5. CF troca o code pelo token, cria/atualiza usuário, retorna customToken
//   6. Front-end faz signInWithCustomToken(auth, customToken)
//   7. onAuthStateChanged dispara com o usuário logado
// ============================================================


// ── Aguarda Firebase estar pronto antes de inicializar ───────────────────────
// O <script type="module"> do index.html é assíncrono — sem esse listener,
// window._firebaseModules pode ser undefined quando auth.js rodar.
function initAuth() {
  const db   = window.db;
  const auth = window.auth;
  const onAuthStateChanged = window.onAuthStateChanged;
  const signOut   = window.signOut;
  const updateDoc = window.updateDoc;
  const doc       = window.doc;
  const onSnapshot = window.onSnapshot;

  // ── Constantes OAuth ──────────────────────────────────────────
  // IMPORTANTE: substitua DISCORD_CLIENT_ID pelo ID real do seu app Discord
  // O Client Secret NUNCA vai aqui — fica apenas nas variáveis da Cloud Function
  const DISCORD_CLIENT_ID  = "1483555790680883210";
  // URI de redirect cadastrada no Discord Developer Portal
  // Deve ser a URL pública desta página: https://SEU-DOMINIO/discord-callback.html
  const DISCORD_REDIRECT_URI = encodeURIComponent(
  "https://aurioshlookin.github.io/NinHawkCCG20/discord-callback.html"
);
  // Scopes necessários: identify (perfil básico)
  const DISCORD_OAUTH_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${DISCORD_REDIRECT_URI}&response_type=code&scope=identify`;
  
  // ── Botão "Entrar com Discord" ────────────────────────────────
  window.loginWithDiscord = () => {
    // Salva a aba/janela atual e abre o OAuth numa nova aba
    // Ao retornar para discord-callback.html, ela faz o login e redireciona
    window.location.href = DISCORD_OAUTH_URL;
  };
  
  // ── Logout ────────────────────────────────────────────────────
  const btnLogoutEl = document.getElementById("btn-logout");
  if (btnLogoutEl) {
    btnLogoutEl.addEventListener("click", async () => {
          await signOut(window.auth);
      window.location.reload();
    });
  }
  
  const mobileBtnLogoutEl = document.getElementById("mobile-btn-logout");
  if (mobileBtnLogoutEl) {
    mobileBtnLogoutEl.addEventListener("click", async () => {
          await signOut(window.auth);
      window.location.reload();
    });
  }
  
  // ── onAuthStateChanged — reage ao login/logout ────────────────

  
  let unsubUser = null;
  
  onAuthStateChanged(auth, (user) => {
    window.currentUser = user;
  
    if (user) {
      // ── Mostra UI de logado ───────────────────────────────────
      const loggedOutView    = document.getElementById("logged-out-view");
      const loggedInView     = document.getElementById("logged-in-view");
      const userDisplayName  = document.getElementById("user-display-name");
      const userAvatarEl     = document.getElementById("user-avatar");
  
      if (loggedOutView) { loggedOutView.classList.add("hidden"); loggedOutView.style.display = "none"; }
      if (loggedInView)  { loggedInView.classList.remove("hidden"); loggedInView.classList.add("flex"); loggedInView.style.display = "flex"; }
  
      // Nome e foto vêm direto do Discord (Firebase Auth os armazena no user.displayName/photoURL)
      if (userDisplayName) userDisplayName.innerText = user.displayName || "Ninja";
      if (userAvatarEl)    userAvatarEl.src = user.photoURL || `https://cdn.discordapp.com/embed/avatars/0.png`;
  
      // Mostra abas exclusivas de usuários logados
      ["tab-gacha","tab-album","tab-rarity","tab-trade","tab-achievements","tab-fusion"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("hidden");
      });
["mobile-btn-logout"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
});
  
      if (document.getElementById("section-explore")?.classList.contains("flex")) {
        window.switchTab("gacha");
      }
  
      // Escuta mudanças em tempo real no documento do usuário
      if (unsubUser) unsubUser();
      unsubUser = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
  
        window.userData = data;
        if (window.globalSettings?.cardsVersion !== data.cardsVersion) {
  if (window.loadCardsCache) window.loadCardsCache();
}
        window.userData.inventory           = data.inventory           || {};
        window.userData.claimedAchievements = data.claimedAchievements || {};
        window.userData.notifications       = data.notifications       || [];
        if (window.userData.premiumPullsAvailable === undefined) window.userData.premiumPullsAvailable = 0;
        if (window.userData.totalTradesCompleted  === undefined) window.userData.totalTradesCompleted  = 0;

        // Normaliza lastPullTimestamp para número (ms)
if (window.userData.lastPullTimestamp?.toMillis) {
  window.userData.lastPullTimestamp = window.userData.lastPullTimestamp.toMillis();
} else if (window.userData.lastPullTimestamp?.seconds) {
  window.userData.lastPullTimestamp = window.userData.lastPullTimestamp.seconds * 1000;
}
  
        // Auto-heal de createdAt (campo não sensível — permitido pelas rules)
        if (!data.createdAt) {
          updateDoc(doc(db, "users", user.uid), { createdAt: new Date(user.metadata.creationTime).getTime() })
            .catch(() => {});
        }
  
        if (window.applyGlobalSettingsUI) window.applyGlobalSettingsUI();
        if (window.updateGachaUI)        window.updateGachaUI();
        if (window.renderAlbumHTML)      window.renderAlbumHTML("album-grid", window.userData.inventory);
        if (window.updateTradeOptions)   window.updateTradeOptions();
        if (window.updateTradeLimitsUI)  window.updateTradeLimitsUI();
        if (window.renderAchievements)   window.renderAchievements();
        if (window.renderNotifications)  window.renderNotifications(window.userData.notifications);
        if (window.updateFusionOptions)  window.updateFusionOptions();
  
        const tabAdmin = document.getElementById("tab-admin");
        if (data.role === "admin") {
          if (tabAdmin) tabAdmin.classList.remove("hidden");
          if (window.suggestNextCardNumber)     window.suggestNextCardNumber();
          if (window.updateAllCardDependentUI)  window.updateAllCardDependentUI();
        } else {
          if (tabAdmin) tabAdmin.classList.add("hidden");
        }
      });
  
    } else {
      // ── Mostra UI de deslogado ────────────────────────────────
      const loggedOutView = document.getElementById("logged-out-view");
      const loggedInView  = document.getElementById("logged-in-view");
  
      if (loggedOutView) { loggedOutView.classList.remove("hidden"); loggedOutView.style.display = "flex"; }
      if (loggedInView)  { loggedInView.classList.add("hidden"); loggedInView.classList.remove("flex"); loggedInView.style.display = "none"; }
  
["tab-admin","tab-trade","tab-achievements","tab-gacha","tab-album","tab-rarity","tab-fusion",
 "mobile-btn-logout"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });
  
      if (unsubUser) { unsubUser(); unsubUser = null; }
      if (window.applyGlobalSettingsUI) window.applyGlobalSettingsUI();
window.switchTab("explore");
    }
  });
}

// Se o Firebase já estava pronto antes deste script carregar (ex: reload),
// inicia imediatamente. Caso contrário aguarda o evento.
if (window._firebaseReady) {
  initAuth();
} else {
  window.addEventListener('firebase-ready', initAuth, { once: true });
}

