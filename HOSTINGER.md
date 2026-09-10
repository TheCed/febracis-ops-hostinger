# FEBRACIS OPS — Deploy Hostinger (emergência)

## O que é este ZIP

App **Node.js única**: API Express + frontend React já buildado (`web/dist`).

- SQLite em `server/data/febracis.sqlite` (persistente no disco do app)
- **Requer Node.js 22.5+** (painel Hostinger → Node.js → versão 22)

## Não consigo subir por você sem acesso

Para eu publicar direto, envie **uma** destas opções:

1. FTP Hostinger: host, usuário, senha, pasta do Node App  
2. Ou SSH + caminho do app  
3. Ou convite ao hPanel

Sem isso, use os passos abaixo (5–10 min).

---

## Passo a passo Hostinger

### 1. Criar aplicação Node.js

1. hPanel → **Websites** → seu site → **Node.js** (ou Advanced → Node.js)
2. Create application
3. **Node version: 22.x** (obrigatório)
4. Application root: pasta onde você vai extrair o ZIP (ex. `febracis-ops`)
5. Application URL: o domínio/subdomínio (ex. `https://ops.seudominio.com`)
6. Application startup file / start: será `npm start` (via `package.json` raiz)

### 2. Subir o ZIP

1. File Manager ou FTP → pasta do app Node
2. Upload `FEBRACIS-OPS-HOSTINGER.zip`
3. Extract **dentro** da pasta do app (deve ficar `package.json`, `server/`, `web/`, `HOSTINGER.md`)

### 3. Criar arquivo `.env`

Na **raiz do app** (mesmo nível do `package.json`), crie `.env`:

```env
NODE_ENV=production
PORT=3000
PUBLIC_URL=https://SEU-DOMINIO-AQUI
CORS_ORIGINS=https://SEU-DOMINIO-AQUI
COOKIE_SECURE=true

BOOTSTRAP_ADMIN_EMAIL=admin@seudominio.com
BOOTSTRAP_ADMIN_PASSWORD=TroqueEstaSenhaForte123
BOOTSTRAP_ADMIN_NAME=Administrador

GOOGLE_AUTH_ENABLED=false
GOOGLE_SHEETS_ENABLED=false
```

**Importante:**

- `PORT` = o que o painel Hostinger indicar (muitas vezes vem em variável automática; se o painel define `PORT`, deixe só o do painel)
- `PUBLIC_URL` e `CORS_ORIGINS` = URL **exata** https do app (sem barra no final)
- A senha do bootstrap deve ter **no mínimo 10 caracteres**
- O admin bootstrap só é criado se o banco estiver **vazio** (primeiro start)

### 4. Instalar e iniciar

No terminal SSH do Hostinger (ou botão Rebuild/Restart do Node app):

```bash
cd ~/caminho/do/app
npm install
npm start
```

Ou no painel: **Restart** após o upload (o `postinstall` instala deps do `server/`).

### 5. Verificar

1. `https://SEU-DOMINIO/api/health` → `{"ok":true,"spa":true,...}`
2. Abrir o domínio → tela de login
3. Entrar com `BOOTSTRAP_ADMIN_EMAIL` / senha
4. **Troque a senha** depois do primeiro acesso (ou crie outro admin e remova o bootstrap do `.env`)

### 6. Depois do primeiro login

Remova do `.env` (opcional, mas recomendado):

```env
BOOTSTRAP_ADMIN_PASSWORD=
```

(ou apague as 3 linhas `BOOTSTRAP_*` — não recria usuário se já existem users)

---

## Google Sheets / Auth (depois da emergência)

Deixe `GOOGLE_*=false` até estabilizar. Depois siga `docs/PRODUCTION_CHECKLIST.md`.

---

## Problemas comuns

| Sintoma | Causa | Ação |
|---------|--------|------|
| App não sobe / sqlite error | Node &lt; 22.5 | Trocar versão Node para 22 |
| `spa:false` no health | Falta `web/dist` | Reextrair ZIP completo |
| Login 403 csrf | CORS/PUBLIC_URL errado | Igualar URL https exata |
| Sem usuário | Bootstrap senha &lt; 10 ou já há users | Conferir `.env` / logs |
| Dados sumiram | Disco efêmero / pasta errada | Garantir `server/data` no storage do app |

---

## Conteúdo do pacote

```
package.json          ← start + postinstall
.env.example
HOSTINGER.md          ← este arquivo
server/               ← API (TypeScript via tsx)
web/dist/             ← frontend buildado
```

**Não** inclui `node_modules` (instala no servidor).  
**Não** inclui banco com dados locais.  
Legacy HTML da pasta raiz do monorepo **não** está neste ZIP (não é necessário para OPS).
