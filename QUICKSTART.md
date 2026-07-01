# Quickstart

From `git clone` to a deployed demo ERC20, a queued Engine transaction, and
indexed transfers in Insight — **9 commands** (plus one `.env` edit for your
deployer key).

**Prerequisites:** Node.js 18+, Docker, and a Polygon Amoy wallet funded with
testnet MATIC ([faucet](https://faucet.polygon.technology/)).

## 1. Clone and install

```bash
git clone https://github.com/devflames/ApkayA-Web3Platform.git
cd ApkayA-Web3Platform
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set **`DEPLOYER_PRIVATE_KEY`** to a funded Amoy wallet (hex,
with or without `0x`). Local dev defaults are fine for everything else.

Propagate into per-app `.env` files:

```bash
npm run env:sync
```

## 3. Start the platform

```bash
docker compose up -d --build
```

This starts **Postgres**, **Engine** (API + tx worker), **Insight** (API +
indexer worker), and the **Dashboard** at [http://localhost:5173](http://localhost:5173).

Open the dashboard — Settings should pre-fill from env. If not, use:

- Engine URL: `http://localhost:3005`
- Insight URL: `http://localhost:3006`
- API key: `dev-secret-key-change-me` (or your `ENGINE_ACCESS_KEYS` value)

## 4. Deploy a demo ERC20

```bash
npm run deploy:token --workspace=@apkaya/contracts
```

Note the printed **`ApkayaToken deployed to:`** address (export it as `TOKEN`).

## 5. Create an Engine backend wallet

```bash
curl -s -X POST http://localhost:3005/backend-wallet/create \
  -H "Authorization: Bearer dev-secret-key-change-me" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"quickstart-wallet\"}"
```

Copy the returned **`id`** and **`address`**. Fund that address with Amoy MATIC
from your deployer wallet (needed for gas), then mint demo tokens:

```bash
TOKEN=0xYourTokenAddress BACKEND_WALLET=0xYourBackendWalletAddress \
  npm run mint:demo --workspace=@apkaya/contracts
```

## 6. Queue an ERC20 transfer

Replace `WALLET_ID`, `TOKEN`, and `RECIPIENT` (any address you control):

```bash
curl -s -X POST http://localhost:3005/transaction/send \
  -H "Authorization: Bearer dev-secret-key-change-me" \
  -H "Content-Type: application/json" \
  -d "{\"chainId\":80002,\"fromWalletId\":\"WALLET_ID\",\"toAddress\":\"TOKEN\",\"data\":\"0xa9059cbb000000000000000000000000RECIPIENT_PADDED0000000000000000000000000000000000000000000000000de0b6b3a7640000\",\"valueWei\":\"0\"}"
```

`data` is standard ERC20 `transfer(address,uint256)` — 1 DEMO token
(`0de0b6b3a7640000` wei). Encode with
[abi.hashex.org](https://abi.hashex.org/) or Hardhat/ethers if you prefer.

The API returns **`202 Accepted`** with `"status":"queued"`.

## 7. Wait for mined

Poll until `status` is `mined` (Engine worker broadcasts within a few seconds):

```bash
curl -s http://localhost:3005/transaction/status/TX_ID \
  -H "Authorization: Bearer dev-secret-key-change-me"
```

Or watch **Transactions** in the dashboard.

## 8. See it in Insight

After a short indexer delay (~5–30s depending on chain head):

```bash
curl -s "http://localhost:3006/insight/transfers?chainId=80002&contractAddress=TOKEN&limit=5" \
  -H "Authorization: Bearer dev-secret-key-change-me"
```

Or open **Insight** in the dashboard for the same chain.

---

## Local dev (without Docker services)

Start Postgres only, then boot everything with one command:

```bash
docker compose up postgres -d
cp .env.example .env && npm run env:sync   # first time only
npm run dev
```

`npm run dev` runs Engine API, Engine worker, Insight API, Insight worker, and
the Vite dashboard together.

## Environment reference

| Variable | Required | Used by |
|---|---|---|
| `DATABASE_URL` | yes | Engine, Insight |
| `ENGINE_ADMIN_KEY` | yes (Engine) | `/api-key/*` |
| `ENGINE_ACCESS_KEYS` | dev default | Engine, Insight auth fallback |
| `WALLET_ENCRYPTION_KEY` | yes (Engine) | backend wallet storage |
| `SESSION_JWT_SECRET` | yes (Engine) | Connect / SIWE |
| `CHAIN_<id>_RPC_URL` | yes | Engine, Insight, deploys |
| `DEPLOYER_PRIVATE_KEY` | deploy only | `packages/contracts` |
| `VITE_*` | optional | Dashboard defaults |

Full list: [`.env.example`](.env.example). Per-app overrides:
[`apps/engine/.env.example`](apps/engine/.env.example),
[`apps/insight/.env.example`](apps/insight/.env.example),
[`apps/dashboard/.env.example`](apps/dashboard/.env.example).

## Troubleshooting

- **Engine 401** — API key must match `ENGINE_ACCESS_KEYS` or a DB-backed key.
- **Tx stuck queued** — is `engine-worker` running? Does the wallet have MATIC?
- **Insight empty** — wait for indexer catch-up; check `insight-worker` logs.
- **Re-run env sync** after editing root `.env`: `npm run env:sync`
