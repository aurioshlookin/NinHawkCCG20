# Nin Online CCG BR — Estrutura e Guia de Setup

## O que mudou nesta versão

- **Login com Discord** substituiu completamente o sistema de nick/senha
- Foto e nome do Discord são usados automaticamente no jogo
- Sem senha, sem cadastro, sem nick único para gerenciar
- Cloud Functions expandidas com `discordAuth` e `verifyAdminPin`
- 6 bugs pós-invasão corrigidos (detalhes abaixo)

---

## Estrutura de Pastas

```
nin-ccg-br/
├── index.html               ← Página principal
├── logs.html                ← Painel de logs admin
├── discord-callback.html    ← Página de retorno do OAuth Discord ⭐ NOVO
├── firestore.rules          ← Security Rules v3 (aplicar no console Firebase)
├── ESTRUTURA.md             ← Este documento
├── .gitignore
│
├── assets/
│   ├── css/style.css        ← CSS extraído do index.html original
│   ├── img/                 ← Imagens locais
│   └── cards/               ← Pasta para imagens de cartas
│
├── js/
│   ├── ui.js                ← Tabs, menu mobile, sons, confetti
│   ├── auth.js              ← Login Discord, onAuthStateChanged ⭐ REESCRITO
│   ├── cards.js             ← Renderização de cartas
│   ├── gacha.js             ← Pacotes (chama Cloud Functions)
│   ├── community.js         ← Ranking e comunidade
│   ├── trade.js             ← Sistema de trocas
│   ├── fusion.js            ← Fusão de cartas
│   └── admin.js             ← Painel administrativo
│
└── functions/
    ├── index.js             ← Cloud Functions ⭐ EXPANDIDO com discordAuth
    ├── package.json
    ├── .env.example         ← Template das variáveis de ambiente ⭐ NOVO
    └── .env                 ← Suas credenciais reais (NÃO commitar — no .gitignore)
```

---

## Setup do Login Discord — Passo a Passo

### 1. Criar o App no Discord Developer Portal

1. Acesse https://discord.com/developers/applications
2. Clique em **New Application** → dê o nome "Nin Online CCG BR"
3. Vá em **OAuth2 → General**
4. Copie o **Client ID** (vai para o `.env` e para o `auth.js`)
5. Clique em **Reset Secret** → copie o **Client Secret** (vai para o `.env` apenas)
6. Em **Redirects**, clique em **Add Redirect** e adicione:
   ```
   https://SEU-USUARIO.github.io/SEU-REPO/discord-callback.html
   ```
   > Exemplo: `https://aurioshlookin.github.io/NinCardMemeCollectionBR/discord-callback.html`
7. Clique em **Save Changes**

### 2. Configurar as variáveis de ambiente

```bash
cd functions
cp .env.example .env
# Edite .env com seus valores reais
```

Conteúdo do `.env`:
```
DISCORD_CLIENT_ID=1234567890123456789
DISCORD_CLIENT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz
DISCORD_REDIRECT_URI=https://aurioshlookin.github.io/NinCardMemeCollectionBR/discord-callback.html
```

### 3. Configurar o Client ID no front-end

Em `js/auth.js`, linha 18, substitua o placeholder:
```javascript
// ANTES:
const DISCORD_CLIENT_ID = "SEU_DISCORD_CLIENT_ID_AQUI";

// DEPOIS:
const DISCORD_CLIENT_ID = "1234567890123456789";
```

> O **Client ID** pode ficar público no código.
> O **Client Secret** NUNCA vai no front-end — fica apenas no `.env`.

### 4. Confirmar a URL das Cloud Functions

Em `index.html` e em `discord-callback.html`, confirme:
```javascript
window.CLOUD_FUNCTIONS_URL = 'https://us-central1-nincardcollectionbr.cloudfunctions.net';
```

### 5. Deploy das Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

### 6. Aplicar as Security Rules

1. Console Firebase → Firestore → Regras → Banco **default2**
2. Cole o conteúdo de `firestore.rules` e publique

---

## Como o Login Funciona

```
Clica "Entrar com Discord"
  → Redireciona para discord.com/oauth2/authorize?client_id=...
  → Jogador aprova
  → Discord redireciona para discord-callback.html?code=XXX
  → Callback envia o code para Cloud Function discordAuth
  → CF troca code por access_token (Client Secret seguro no servidor)
  → CF busca perfil: id, username, avatar
  → CF cria/atualiza usuário Firebase Auth (uid = "discord_ID")
  → CF cria/atualiza documento Firestore com dados do jogo
  → CF retorna customToken
  → signInWithCustomToken(auth, customToken)
  → onAuthStateChanged dispara — jogador logado com nome e foto Discord
```

---

## Bugs Corrigidos (v3)

| # | Bug | Correção |
|---|---|---|
| BUG-01 | `openPack()` gravava campos sensíveis direto no Firestore | Chama Cloud Function |
| BUG-02 | Auto-heal escrevia campos bloqueados pelas rules | Removido do cliente |
| BUG-03 | `logGlobalStat()` sem permissão de escrita | Movido para Cloud Function |
| BUG-04 | `community` aceitava write de qualquer autenticado | Restrito a admins |
| BUG-05 | `syncLeaderboard()` chamado pelo cliente | Movido para Cloud Function |
| BUG-06 | `admin_security` com `read: if true` expunha senhas | Cloud Function `verifyAdminPin` |

---

## Migração das Contas Antigas

As contas nick/senha ficam inacessíveis — o jogo não tem mais interface para usá-las.
Para limpar: Console Firebase → Authentication → Users → deletar manualmente.
Os documentos Firestore de jogadores antigos podem ser deletados também, ou mantidos como histórico.

---

## Segurança

- **Client ID** do Discord: público (aparece na URL OAuth) — sem problema
- **Client Secret**: somente em `functions/.env` — nunca no GitHub
- **`.env`** está no `.gitignore` — confirme antes de qualquer commit
- UID de cada jogador: `discord_DISCORDID` — estável e único para sempre
- Banimentos por Discord ID são mais eficazes que por IP
