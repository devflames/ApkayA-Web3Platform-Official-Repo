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

```bash
cd apps/engine
cp .env.example .env
# generate real values for WALLET_ENCRYPTION_KEY and ENGINE_ADMIN_KEY:
openssl rand -hex 32   # run twice, paste into .env

npm install
npm run dev       # starts the API server on :3005
npm run worker     # in a second terminal — starts the tx worker
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
| POST | `/api-key/create` | Issue a new key. Body: `{ "label": "acme-corp" }`. The raw key is returned **once**, in this response only. |
| GET | `/api-key` | List all keys (hashes never exposed, only a display prefix) |
| GET | `/api-key/:id` | Get one key's metadata |
| POST | `/api-key/:id/revoke` | Revoke a key immediately |
| POST | `/api-key/:id/reactivate` | Un-revoke a key |

**POST /api-key/create response:**
```json
{
  "result": {
    "id": "kX1a...",
    "label": "acme-corp",
    "key_prefix": "sk_live_a1b2c3d4",
    "key": "sk_live_a1b2c3d4e5f6...",
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

## Adding a new chain

No code change needed — add two env vars and restart:
```
CHAIN_8453_RPC_URL=https://mainnet.base.org
CHAIN_8453_NAME=Base
```

## Production hardening checklist (not yet done in this v0)

- [ ] Swap SQLite for Postgres (schema in `src/db/schema.sql` is written to port cleanly)
- [x] ~~Replace the static `ENGINE_ACCESS_KEYS` allowlist with the `api_keys` table~~ — done. `ENGINE_ACCESS_KEYS` is now a legacy fallback only; leave it unset once you're issuing real keys.
- [ ] Move backend wallet keys from local AES-encrypted storage to a KMS (AWS KMS / GCP KMS / HashiCorp Vault)
- [ ] Per-wallet nonce manager (in-memory queue) instead of relying on `getTransactionCount("pending")` under heavy concurrent load on the same wallet
- [ ] Webhook retry queue with exponential backoff (currently single-attempt, best-effort)
- [ ] Per-API-key rate limiting (currently global IP-based only) — `req.apiKeyId` is already available in route handlers for this
- [ ] Key rotation flow (issue new + grace-period-revoke old) and scoped permissions per key (e.g. read-only keys)
