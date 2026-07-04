# Engine

Self-hostable backend HTTP server that queues, signs, and sends blockchain
transactions on behalf of your app. This is the most reusable piece of the
platform — it has no dependency on the dashboard or SDK and can be deployed
standalone.

## How it works

```
 Your app ──POST /transaction/send──▶ Engine API ──▶ transactions table (status: queued)
                                                              │
                                                  tx worker polls every 2s
                                                              │
                                                  signs with backend wallet,
                                                  estimates gas, broadcasts
                                                              │
                                                  status: sent ──▶ mined / reverted
                                                              │
                                                  fires webhook at each transition
```

The API process and the worker process are **separate** so you can scale them
independently (e.g. 1 API replica behind a load balancer, N worker replicas
pulling from the same Postgres/SQLite-backed queue).

## Run locally

### Option A — Docker (recommended)

```bash
# from the repo root
docker compose up postgres -d
```

### Option B — Native PostgreSQL (Windows / macOS / Linux)

If PostgreSQL is already installed locally, reset the project database (does **not**
migrate old SQLite data):

```powershell
# PowerShell — set your postgres superuser password, then:
$env:POSTGRES_SUPER_PASSWORD = "your-postgres-install-password"
.\apps\engine\scripts\setup-postgres.ps1
```

This drops and recreates the `engine` database and `apkaya` role. To fully
reinstall PostgreSQL 17 on Windows instead, add `-ReinstallServer` (requires
administrator shell).

### Start Engine

```bash
cd apps/engine
cp .env.example .env
# fill ENGINE_ADMIN_KEY, WALLET_ENCRYPTION_KEY (openssl rand -hex 32)
# DATABASE_URL=postgres://apkaya:apkaya@localhost:5432/engine

npm install
npm run migrate        # optional — migrations also run on API/worker start
npm run dev            # API on :3005
npm run worker         # second terminal — tx worker
npm run webhook-worker # third terminal — webhook retry worker (when WEBHOOK_URL is set)
```

Then issue your first customer key:
```bash
curl -X POST http://localhost:3005/api-key/create \
  -H "Authorization: Bearer <your ENGINE_ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"label": "my first app"}'
```
Use the returned `key` (not the admin key) in your app's SDK/CLI config.

## API Reference

All endpoints (except `/health`) require `Authorization: Bearer <key>`.
Two kinds of key exist:

- **Customer API keys** — created via `/api-key/create`, hashed at rest,
  individually revocable. Use these for `/backend-wallet`, `/transaction`,
  `/chain`.
- **The admin key** (`ENGINE_ADMIN_KEY`) — a single master key that can
  only call `/api-key/*` to issue or revoke customer keys. It cannot be
  used to send transactions or manage wallets, and should never be handed
  to a customer or embedded in client apps.

### API Keys (admin-only)

| Method | Path | Description |
|---|---|---|
| POST | `/api-key/create` | Issue a new key. Body: `{ "label": "acme-corp", "rateLimitPerMinute": 120 }` (rate limit optional). The raw key is returned **once**, in this response only. |
| GET | `/api-key` | List all keys (hashes never exposed, only a display prefix) |
| GET | `/api-key/:id` | Get one key's metadata |
| POST | `/api-key/:id/revoke` | Revoke a key immediately |
| POST | `/api-key/:id/reactivate` | Un-revoke a key |
| POST | `/api-key/:id/rate-limit` | Set per-key rate limit. Body: `{ "rateLimitPerMinute": 60 }` or `null` to use the instance default |

**POST /api-key/create response:**
```json
{
  "result": {
    "id": "kX1a...",
    "label": "acme-corp",
    "key_prefix": "sk_live_a1b2c3d4",
    "key": "sk_live_a1b2c3d4e5f6...",
    "rate_limit_per_minute": null,
    "created_at": "2026-07-01 03:10:00",
    "is_active": 1
  }
}
```
Store `key` now — Engine only ever stores its SHA-256 hash, so it cannot
be shown again. If it's lost, revoke it and issue a new one.

### Backend Wallets

| Method | Path | Description |
|---|---|---|
| POST | `/backend-wallet/create` | Create a new managed wallet. Body: `{ "label": "my-wallet" }` |
| GET | `/backend-wallet` | List all backend wallets |
| GET | `/backend-wallet/:id` | Get one wallet |
| GET | `/backend-wallet/:id/balance?chainId=80002` | Native token balance |

### Transactions

| Method | Path | Description |
|---|---|---|
| POST | `/transaction/send` | Queue a transaction. See body schema below. |
| GET | `/transaction/status/:id` | Poll status of a queued/sent transaction |
| GET | `/transaction?status=&walletId=&chainId=&limit=` | List/filter transactions |
| POST | `/transaction/cancel/:id` | Cancel a transaction that hasn't been sent yet |

**POST /transaction/send body:**
```json
{
  "chainId": 80002,
  "fromWalletId": "wallet_abc123",
  "toAddress": "0x000000000000000000000000000000000000dEaD",
  "data": "0x",
  "valueWei": "1000000000000000",
  "idempotencyKey": "order-42",
  "metadata": { "orderId": 42 }
}
```
Returns `202 Accepted` with the queued transaction record immediately —
the caller does not wait for on-chain confirmation in this call.

### Chains

| Method | Path | Description |
|---|---|---|
| GET | `/chain` | List chains configured via `CHAIN_<id>_RPC_URL` env vars |

### Contracts

| Method | Path | Description |
|---|---|---|
| POST | `/contract/register` | Register a deployed contract + ABI. Body: `{ chainId, address, name, abi, deployerWalletId?, txId? }` |
| GET | `/contract` | List registered contracts (`?chainId=&limit=`) |
| GET | `/contract/:id` | Get one contract with parsed ABI and function list |
| POST | `/contract/:id/read` | Call a view/pure function. Body: `{ functionName, args? }` → `{ value }` |
| POST | `/contract/:id/write` | Queue a state-changing call via the tx pipeline. Body: `{ fromWalletId, functionName, args?, valueWei?, idempotencyKey?, metadata? }` → `202` with transaction record |

**POST /contract/register body:**
```json
{
  "chainId": 80002,
  "address": "0x0000000000000000000000000000000000000001",
  "name": "ApkayaToken",
  "abi": [ "... Solidity JSON ABI ..." ],
  "deployerWalletId": "wallet_abc123",
  "txId": "tx_optional_engine_id"
}
```

**POST /contract/:id/read body:**
```json
{ "functionName": "balanceOf", "args": ["0x000000000000000000000000000000000000dEaD"] }
```

**POST /contract/:id/write body:**
```json
{
  "fromWalletId": "wallet_abc123",
  "functionName": "mintTo",
  "args": ["0x000000000000000000000000000000000000dEaD", "1000000000000000000"],
  "valueWei": "0"
}
```


### End-user auth (Connect / SIWE)

Separate from developer API-key auth. All `/auth/*` routes still require your
app's Bearer API key; end-user sessions are issued as JWTs via
`X-Apkaya-Session` on in-app wallet operations.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/siwe/nonce` | Generate EIP-4361 SIWE message. Body: `{ address, chainId, domain, uri, statement? }` |
| POST | `/auth/siwe/verify` | Verify SIWE signature → session JWT |
| POST | `/auth/email/request-code` | Send email OTP (dev: set `ENGINE_AUTH_DEV_LOG_OTP=true`) |
| POST | `/auth/email/verify-code` | Verify OTP → creates in-app wallet + session JWT |
| GET | `/auth/session` | Current session info (requires `X-Apkaya-Session`) |
| POST | `/auth/in-app/sign-message` | Sign with custody wallet (email sessions only) |
| POST | `/auth/in-app/send-transaction` | Queue tx from custody wallet → `202` |
| GET | `/auth/in-app/wallet` | Address for current session |

Env: `SESSION_JWT_SECRET` (required), `SESSION_JWT_TTL_SECONDS` (default 7d),
`ENGINE_AUTH_DEV_LOG_OTP=true` for local OTP logging.

### Bridge (CDP)

Coinbase Developer Platform integration for buy/swap widgets. **CDP secrets are server-only.**

| Method | Path | Description |
|---|---|---|
| GET | `/bridge/supported` | CDP config status + chain/token metadata for widgets |
| POST | `/bridge/onramp/session` | Create CDP onramp session token + popup URL. Body: `{ address, chainId, clientIp, assets?, presetFiatAmount? }` |
| POST | `/bridge/swap/quote` | CDP swap quote (201). Body: `{ chainId, fromToken, toToken, fromAmount, taker, slippageBps? }` |
| POST | `/bridge/swap/execute` | Fresh quote for signing (BYO wallet). Same body as quote — never cache quotes |

Env: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` (CDP Secret API Key from portal.cdp.coinbase.com).

Swap mainnets: Ethereum, Base, Arbitrum, Optimism, Polygon (see `@apkaya/bridge` README).

## Transaction lifecycle

`queued → sent → mined`
`queued → sent → reverted` (on-chain failure)
`queued → errored` (failed to broadcast after `TX_WORKER_MAX_RETRIES` attempts)
`queued → cancelled` (cancelled before being sent)

## Webhooks

Set `WEBHOOK_URL` to receive POSTs on `tx.sent`, `tx.mined`, `tx.reverted`,
`tx.errored`. Each request is signed with an HMAC-SHA256 signature in the
`X-Engine-Signature` header, computed over the raw JSON body using
`WEBHOOK_SECRET`. Verify it server-side before trusting the payload.

Delivery is **durable with retries**. Every event is stored in
`webhook_events` and delivered immediately when possible. Failures are retried
by the webhook worker (`npm run webhook-worker`) with exponential backoff:
**5s → 30s → 2m → 10m → 1h** (six total attempts). After the final failure the
event is marked `delivery_status = dead` and `last_error` records the reason.

Webhook event fields: `attempts`, `next_attempt_at`, `last_error`,
`delivery_status` (`pending` | `delivered` | `dead`).

## Rate limiting

Customer API routes (`/backend-wallet`, `/transaction`, `/chain`, `/contract`, `/auth`, `/bridge`) are limited
per API key using a fixed one-minute window. The default limit comes from
`DEFAULT_API_KEY_RATE_LIMIT_PER_MINUTE` (default **120**). Override per key via
`api_keys.rate_limit_per_minute` or `POST /api-key/:id/rate-limit`. Legacy
`ENGINE_ACCESS_KEYS` share a per-IP bucket at the same default. A separate
global IP ceiling (`GLOBAL_IP_RATE_LIMIT_PER_MINUTE`, default **600**) applies
to all routes except `/health`.

Exceeded limits return **429** with `{ "error": "...", "limitPerMinute": N }`.

## Adding a new chain

No code change needed — add env vars and restart.

**EVM** (default family):

```
CHAIN_8453_RPC_URL=https://mainnet.base.org
CHAIN_8453_NAME=Base
# CHAIN_8453_FAMILY=evm   # optional; default is evm
```

**Solana**:

```
CHAIN_devnet_FAMILY=solana
CHAIN_devnet_RPC_URL=https://api.devnet.solana.com
CHAIN_devnet_NAME=Solana Devnet
CHAIN_devnet_COMMITMENT=confirmed
```

`GET /chain` returns `{ chainFamily, chainId, name, rpcUrl }` for each configured chain.
Solana backend wallets use ed25519 keys (`chain_family=solana`); EVM wallets remain secp256k1.
Contract deploy/read/write routes are **EVM-only** in this release.

## Production hardening checklist (not yet done in this v0)

- [x] Swap SQLite for Postgres — `DATABASE_URL` + `migrations/` via node-pg-migrate
- [x] ~~Replace the static `ENGINE_ACCESS_KEYS` allowlist with the `api_keys` table~~ — done. `ENGINE_ACCESS_KEYS` is now a legacy fallback only; leave it unset once you're issuing real keys.
- [ ] Move backend wallet keys from local AES-encrypted storage to a KMS (AWS KMS / GCP KMS / HashiCorp Vault)
- [x] Per-wallet nonce manager — in-memory per-worker allocator in `src/services/nonceManager.ts`, seeded from chain pending count, with periodic reconciliation
- [x] Webhook retry queue with exponential backoff — `webhook_events` + `webhook-worker` (5s/30s/2m/10m/1h, then dead)
- [x] Per-API-key rate limiting — `rateLimitByApiKey` middleware + `api_keys.rate_limit_per_minute`
- [ ] Key rotation flow (issue new + grace-period-revoke old) and scoped permissions per key (e.g. read-only keys)
