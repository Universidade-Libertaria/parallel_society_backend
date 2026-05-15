# 🚀 Branch `staging` — Changelog & Merge Notes

> **Base:** `main` @ `7c0892b`
> **Criada em:** 2026-05-15
> **Projeto Firebase:** `parallel-society-staging`

---

## 📋 Resumo das Alterações

Esta branch configura o backend para rodar no **ambiente de staging** (homologação), apontando para a **RSK Testnet (chainId 31)** e o projeto Firebase `parallel-society-staging`.

---

## 🔄 O que mudou em relação à `main`

### 1. 🗑️ Remoção do `.env.example`

**Commit:** `chore: remove .env.example template file`

O arquivo `functions/.env.example` foi removido. As variáveis de ambiente agora são gerenciadas por:
- `functions/.env` → ambiente de produção (gitignored)
- `functions/.env.staging` → ambiente de staging (gitignored)

> [!NOTE]
> **Para a main:** Avaliar se vale manter um `.env.example` atualizado para onboarding de novos devs, ou documentar as variáveis diretamente no README.

---

### 2. 📁 Adição do `.firebaserc`

**Commit:** `ci: add .firebaserc with staging project alias`

```json
{
  "projects": {
    "staging": "parallel-society-staging"
  }
}
```

> [!IMPORTANT]
> **Para a main:** Ao fazer merge, o `.firebaserc` deve incluir **ambos** os aliases:
> ```json
> {
>   "projects": {
>     "default": "parallel-society-prod",
>     "staging": "parallel-society-staging"
>   }
> }
> ```

---

### 3. 🔧 Normalização do endereço LUT Token (EIP-55 Checksum)

**Commit:** `fix(lut): normalize token address with EIP-55 checksum`
**Arquivo:** `functions/src/services/lutBalance.ts`

```diff
- const LUT_TOKEN_ADDRESS = process.env.LUT_TOKEN_ADDRESS || '';
+ const RAW_LUT_ADDRESS = process.env.LUT_TOKEN_ADDRESS || '';
+ const LUT_TOKEN_ADDRESS = RAW_LUT_ADDRESS ? ethers.getAddress(RAW_LUT_ADDRESS.trim().toLowerCase()) : '';
```

Esse fix resolve o erro `invalid address` que ocorria quando o endereço no `.env` não estava com checksum EIP-55 correto. A função `ethers.getAddress()` normaliza qualquer formato válido.

> [!TIP]
> **Para a main:** ✅ **Este fix DEVE ser portado para a main.** É uma correção universal que previne erros de endereço independente do ambiente.

---

### 4. ⛓️ Switch do `snapshotChainId` para RSK Testnet

**Commit:** `feat(proposals): switch snapshotChainId to RSK Testnet`
**Arquivo:** `functions/src/proposals/createProposal.ts` — linha 140

```diff
- snapshotChainId: 30, // RSK Mainnet
+ snapshotChainId: 31, // RSK Testnet
```

O `snapshotChainId` está **hardcoded** na criação de propostas. Na staging usamos Testnet (31), na produção deve ser Mainnet (30).

> [!WARNING]
> **Para a main:** ⚠️ **NÃO fazer merge direto deste valor.** Ao fazer merge, garantir que o chainId volte para `30` na main.
>
> **Recomendação futura:** Extrair para variável de ambiente:
> ```typescript
> snapshotChainId: parseInt(process.env.RSK_CHAIN_ID || '30'),
> ```
> Isso elimina a necessidade de alterar código entre ambientes.

---

### 5. 📦 Upgrade das Dependências Firebase + Jest

**Commit:** `chore(deps): upgrade firebase SDKs and add jest test tooling`
**Arquivos:** `functions/package.json`, `functions/package-lock.json`

#### Upgrades de produção:
| Pacote | Main | Staging |
|--------|------|---------|
| `firebase-admin` | `^12.0.0` | `^13.9.0` |
| `firebase-functions` | `^4.6.0` | `^7.2.5` |

#### Novas dependências de dev:
| Pacote | Versão |
|--------|--------|
| `jest` | `^30.3.0` |
| `ts-jest` | `^29.4.9` |
| `@types/jest` | `^30.0.0` |

Também foi adicionado o script `"test": "jest"` no `package.json`.

> [!CAUTION]
> **Para a main:** Os upgrades de `firebase-admin` (v12 → v13) e `firebase-functions` (v4 → v7) são **major versions** com possíveis breaking changes. Antes de fazer merge:
> 1. Revisar os [changelogs do firebase-admin v13](https://github.com/firebase/firebase-admin-node/releases) e [firebase-functions v7](https://github.com/firebase/firebase-functions/releases)
> 2. Testar todas as Cloud Functions no emulador local
> 3. Validar que o deploy funciona no staging antes de replicar na main
>
> O tooling de Jest pode ser portado diretamente ✅

---

## 🧭 Checklist de Merge para `main`

Quando for o momento de promover staging → main:

- [ ] **`.firebaserc`** — Adicionar alias `default` para o projeto de produção
- [ ] **`snapshotChainId`** — Reverter para `30` (RSK Mainnet) ou extrair para env var
- [ ] **`lutBalance.ts`** — ✅ Pode ir direto (fix universal)
- [ ] **`firebase-admin` / `firebase-functions`** — Testar breaking changes antes do merge
- [ ] **Jest tooling** — ✅ Pode ir direto
- [ ] **`.env.example`** — Decidir se recria ou documenta vars no README
- [ ] Variáveis de ambiente (`.env`) configuradas para produção no ambiente de deploy

---

## 🌐 Variáveis de Ambiente (Staging)

As seguintes variáveis devem estar configuradas em `functions/.env.staging`:

```env
# RSK Testnet
RSK_RPC_URL=https://public-node.testnet.rsk.co
RSK_CHAIN_ID=31

# LUT Token (Testnet contract)
LUT_TOKEN_ADDRESS=0x...  # Endereço do contrato LUT na Testnet
LUT_TOKEN_DECIMALS=18

# Auth
NONCE_EXPIRATION_MS=300000
```

---

## 📡 Deploy no Staging

```bash
# Selecionar projeto staging
firebase use staging

# Deploy das functions
firebase deploy --only functions

# Ver logs
firebase functions:log
```
