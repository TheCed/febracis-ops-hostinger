# Google Sheets — CONFIRMAÇÕES DE TURMA CHAPECÓ

Planilha de produção:

`https://docs.google.com/spreadsheets/d/1F7ksT-v3kQhK5KS2XQ9tDM6_JcMLr22Ovtj-0jxcZ6I`

ID: `1F7ksT-v3kQhK5KS2XQ9tDM6_JcMLr22Ovtj-0jxcZ6I`

Cada aba de turma (ex.: `IF 08`, `CEOP05`) tem cabeçalho típico na **linha 5**:
`ALUNO | CPF/CNPJ | TELEFONE | EMAIL | LINK COMPRA | CONSULTOR`

O sistema detecta a linha de cabeçalho automaticamente e ignora `LEGENDAS`, `MODELO` e abas `CANCELADA*`.

## 1. Criar API + service account (conta House)

Com `housechapeco@febracis.com.br`:

1. Abra [Google Cloud Console](https://console.cloud.google.com/)
2. Crie/selecione um projeto (ex.: `febracis-ops-chapeco`)
3. **APIs e serviços → Biblioteca → Google Sheets API → Ativar**
4. **Credenciais → Criar credenciais → Conta de serviço**
   - Nome: `febracis-ops-sheets`
   - Papel: nenhum obrigatório no projeto
5. Na conta criada → **Chaves → Adicionar chave → JSON** → baixe o arquivo
6. Copie o e-mail da SA (`…@….iam.gserviceaccount.com`)

## 2. Compartilhar a planilha

Na planilha Chapecó → **Compartilhar** → adicione o e-mail da service account como **Leitor**.

## 3. Variáveis de ambiente

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=1F7ksT-v3kQhK5KS2XQ9tDM6_JcMLr22Ovtj-0jxcZ6I
GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account",...todo o JSON numa linha...}
```

Ou arquivo:

```env
GOOGLE_SHEETS_CREDENTIALS_PATH=/caminho/seguro/sa.json
```

No Hostinger: cole `GOOGLE_SHEETS_*` em **Variáveis de ambiente** (ou `app.env` no deploy privado) e reinicie.

## 4. Importar no sistema

1. Login admin
2. **Migração** → **Importar planilha Chapecó**
   - ou `POST /api/ops/migration/run-sheet` (todas as abas importáveis)
   - ou `POST /api/ops/migration/run-sheet` com `{ "sheets": ["IF 08","CEOP05"] }`
3. Listar abas: `GET /api/ops/migration/sheets`
4. Conferir **Agenda de turmas** / **Confirmações**

## APIs

| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/google-sheets/status` | Status MOCK/produção |
| POST | `/api/google-sheets/test` | Testa credenciais |
| GET | `/api/ops/migration/sheets` | Lista abas da planilha |
| POST | `/api/ops/migration/run-sheet` | Importa turmas → `training_classes` + inscrições |
| GET | `/api/ops/turmas` | Turmas já no sistema |
