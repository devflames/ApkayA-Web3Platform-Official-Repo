# Insight

Read-only blockchain indexer and query API. Polls configured EVM chains for
ERC20 `Transfer` and ERC721/1155 `Transfer` / `TransferSingle` / `TransferBatch`
events, stores decoded logs in Postgres, and exposes a REST read API.

## How it works

```
 RPC (CHAIN_<id>_RPC_URL) ◀── indexer worker polls eth_getLogs in chunks
         │                         │
         │                         ▼
         │              events + indexer_state tables (Postgres)
         │                         │
         ▼                         ▼
   reorg check (block hash)   Insight API (Bearer auth, shared api_keys)
```

The API process and the indexer worker are **separate** so you can scale read
traffic independently from indexing throughput.

Insight reuses Engine's chain configuration (`CHAIN_<id>_RPC_URL`) and
customer API key auth via `@apkaya/engine/platform` — no duplicated auth logic.

## Run locally

### Option A — Docker (recommended)

```bash
# from the repo root
docker compose up postgres -d
```

### Option B — Native PostgreSQL

Use the same Postgres instance as Engine (`DATABASE_URL=postgres://apkaya:apkaya@localhost:5432/engine`).
See `apps/engine/README.md` for setup scripts.

### Start Insight

```bash
cd apps/insight
cp .env.example .env   # or: cp ../../.env.example ../../.env && npm run env:sync
# same CHAIN_* vars and DATABASE_URL as Engine
# use a customer API key from Engine (POST /api-key/create)

npm install
npm run migrate        # optional — migrations also run on API/worker start
npm run dev            # API on :3006
npm run worker         # second terminal — indexer worker
```

Use the same customer API key you use for Engine. Insight reads the shared
`api_keys` table — admin keys are not accepted on `/insight/*`.

## API Reference

All endpoints (except `/health`) require `Authorization: Bearer <customer-api-key>`.

| Method | Path | Description |
|---|---|---|
| GET | `/insight/status` | Last indexed block per chain |
| GET | `/insight/tokens/:address/balances?chainId=` | ERC20 balances derived from indexed `Transfer` events |
| GET | `/insight/nfts/:address/owned?chainId=&contractAddress=` | ERC721 + ERC1155 ownership from indexed transfers |
| GET | `/insight/transfers?chainId=&contractAddress=&fromBlock=&toBlock=&limit=` | Recent transfer events |
| GET | `/insight/events?chainId=&contractAddress=&eventName=&limit=` | Filter indexed events |

**GET /insight/transfers response (excerpt):**
```json
{
  "result": [
    {
      "id": "42",
      "chain_id": 80002,
      "block_number": "12345678",
      "tx_hash": "0xabc…",
      "log_index": 0,
      "contract_address": "0x000…0001",
      "event_name": "Transfer",
      "decoded_args_json": { "from": "0x…", "to": "0x…", "value": "1000000000000000000" },
      "indexed_at": "2026-07-01 12:00:00+00"
    }
  ]
}
```

## Indexer behavior

- **Block chunks:** `INSIGHT_BLOCK_CHUNK` (default **2000**) blocks per `eth_getLogs` call
- **Confirmations:** waits `INSIGHT_CONFIRMATIONS` (default **3**) blocks behind head
- **Bootstrap:** on first run, indexes from `INSIGHT_START_BLOCK`, `CHAIN_<id>_INSIGHT_START_BLOCK`, or `head - INSIGHT_BOOTSTRAP_LOOKBACK` (default 10 000)
- **Reorg handling:** compares stored block hashes to live RPC; on mismatch, deletes events from that block forward and re-indexes
- **Idempotency:** unique constraint on `(chain_id, tx_hash, log_index)` — safe to re-run

## Environment

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3006` | HTTP port |
| `DATABASE_URL` | — | Same Postgres as Engine |
| `CHAIN_<id>_RPC_URL` | — | Same as Engine |
| `INSIGHT_POLL_INTERVAL_MS` | `5000` | Worker poll interval |
| `INSIGHT_BLOCK_CHUNK` | `2000` | Blocks per getLogs |
| `INSIGHT_CONFIRMATIONS` | `3` | Blocks behind head |
| `INSIGHT_REORG_CHECK_DEPTH` | `64` | Blocks scanned for reorgs |
| `INSIGHT_BOOTSTRAP_LOOKBACK` | `10000` | Initial lookback when no start block set |

## SDK

```typescript
const client = new ApkayaClient({
  baseUrl: "http://localhost:3005",
  insightBaseUrl: "http://localhost:3006", // optional; defaults from Engine URL
  apiKey: "sk_live_…",
});

const transfers = await client.insight.transfers({ chainId: 80002, limit: 20 });
const balances = await client.insight.tokenBalances("0x…", 80002);
const nfts = await client.insight.nftsOwned("0x…", { chainId: 80002 });
```

## Adding a new chain

No Insight code change — add Engine chain env vars and restart both Engine and Insight:

```
CHAIN_8453_RPC_URL=https://mainnet.base.org
CHAIN_8453_NAME=Base
```

Optional per-chain start block: `CHAIN_8453_INSIGHT_START_BLOCK=0`.
