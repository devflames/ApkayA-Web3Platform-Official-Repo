# Phase 9 — Non-EVM (Solana) Design

**Status:** Approved and implemented (Phase 9).

This document covers how ApkayA Engine and Insight generalize beyond EVM-only
assumptions. Scope: **backend wallets, SOL/SPL transfers, balance reads, basic
indexing**. Solana program deployment (Anchor) is explicitly out of scope.

---

## 1. Chain identifier model

### Problem

Today every chain-scoped row uses `chain_id INTEGER` and Engine config assumes
EVM JSON-RPC (`ethers.JsonRpcProvider`). Solana uses cluster names
(`devnet`, `testnet`, `mainnet-beta`), base58 addresses, ed25519 keys, slots
(not blocks), and signatures (not `0x` hashes).

### Proposed canonical type

```typescript
export type ChainFamily = "evm" | "solana";

export interface ChainRef {
  chainFamily: ChainFamily;
  /** EVM: numeric string e.g. "8453". Solana: cluster id e.g. "devnet". */
  chainId: string;
}

/** Stable DB/API key: "evm:8453", "solana:devnet" */
export function chainKey(ref: ChainRef): string {
  return `${ref.chainFamily}:${ref.chainId}`;
}
```

JSON API responses expose `{ chainFamily, chainId }` on chains, transactions,
and indexer status. Request bodies accept the same shape. For backward
compatibility during transition, Engine **also accepts** `chainId: number` on
EVM-only routes when `chainFamily` is omitted (treated as `{ chainFamily: "evm", chainId: String(n) }`).

### Database changes

| Table | Current | Change |
|---|---|---|
| `transactions` | `chain_id INTEGER` | Add `chain_family TEXT NOT NULL DEFAULT 'evm'`. Alter `chain_id` → `TEXT NOT NULL`. Backfill: `chain_family='evm'`, `chain_id=chain_id::text`. |
| `backend_wallets` | chain-agnostic, EVM address | Add `chain_family TEXT NOT NULL DEFAULT 'evm'`. Drop global `UNIQUE(address)`; add `UNIQUE(chain_family, address)`. |
| `deployed_contracts` | `chain_id INTEGER` | Same family + text migration. Remains **EVM-only** in Phase 9 (no Solana program rows). |
| `siwe_nonces` | `chain_id INTEGER` | Same migration; SIWE stays EVM-only (no Solana auth in this phase). |
| **Insight** `indexer_state` | PK `chain_id INTEGER` | PK → `(chain_family, chain_id TEXT)`. Column `last_indexed_block` **renamed** `last_indexed_cursor` (`BIGINT`) — slot for Solana, block for EVM. |
| **Insight** `indexer_block_hashes` | `(chain_id, block_number)` | Rename to `indexer_cursors` with `(chain_family, chain_id, cursor_value, cursor_hash)` — generic reorg anchor. |
| **Insight** `events` | EVM log fields | Add `chain_family`. `chain_id` → `TEXT`. Keep columns but document semantics per family (see §4). |

**Backfill migration (single `1738800000000_phase9-chain-family.cjs` in Engine + Insight):**

```sql
-- Example pattern for transactions
ALTER TABLE transactions ADD COLUMN chain_family TEXT NOT NULL DEFAULT 'evm';
ALTER TABLE transactions ALTER COLUMN chain_id TYPE TEXT USING chain_id::text;
-- Repeat for other tables; then drop defaults if desired
```

All existing rows get `chain_family = 'evm'` automatically via column default
before the default is removed.

**Indexes:** Replace `idx_tx_chain` with `(chain_family, chain_id)`. Same for
Insight event queries.

### Config env vars (extend, do not replace)

Current pattern (`apps/engine/README.md`):

```
CHAIN_8453_RPC_URL=https://mainnet.base.org
CHAIN_8453_NAME=Base
```

**Extended pattern:**

```
# EVM (unchanged behavior; FAMILY optional, defaults to evm)
CHAIN_8453_RPC_URL=https://mainnet.base.org
CHAIN_8453_NAME=Base
# CHAIN_8453_FAMILY=evm          # optional

# Solana
CHAIN_devnet_FAMILY=solana
CHAIN_devnet_RPC_URL=https://api.devnet.solana.com
CHAIN_devnet_NAME=Solana Devnet
# Optional commitment level for send/confirm/index (default: confirmed)
CHAIN_devnet_COMMITMENT=confirmed
```

**Loader change** in `apps/engine/src/services/chains.ts`:

- Regex: `CHAIN_([A-Za-z0-9_]+)_RPC_URL` (was digits-only).
- Read `CHAIN_<id>_FAMILY` → `"evm" | "solana"`, default `"evm"`.
- Read `CHAIN_<id>_COMMITMENT` for Solana (optional).
- `ChainConfig` becomes:

```typescript
export interface ChainConfig {
  chainFamily: ChainFamily;
  chainId: string;       // was number
  name: string;
  rpcUrl: string;
  commitment?: "processed" | "confirmed" | "finalized"; // solana only
}
```

`listChains()` / `GET /chain` return `chainFamily` + string `chainId`.
Insight reads the same env via `@apkaya/engine/platform`.

---

## 2. ChainAdapter interface

Extract all chain-specific wallet, fee, send, and confirm logic behind an
adapter. **EvmAdapter** wraps existing code with no behavior change.

### Location

```
apps/engine/src/adapters/
  types.ts          # ChainAdapter interface + shared types
  registry.ts       # getAdapter(ref: ChainRef): ChainAdapter
  evmAdapter.ts     # wraps wallets.ts / txWorker EVM path
  solanaAdapter.ts  # new
```

### Interface

```typescript
export interface CreateWalletResult {
  address: string;
  encryptedKey: string;
  keyType: string;       // "local" | "solana_local"
  chainFamily: ChainFamily;
}

export interface FeeEstimate {
  /** EVM: wei string. Solana: lamports string (base fee + priority). */
  feeAmount: string;
  /** EVM-only metadata */
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFee?: string;
}

export interface SendResult {
  txHash: string;          // 0x… or base58 signature
  /** EVM: assigned nonce. Solana: undefined */
  nonce?: number;
  feeAmount?: string;
  extra?: Record<string, unknown>;
}

export interface ConfirmResult {
  status: "mined" | "reverted" | "pending";
  /** EVM: block number. Solana: slot number. */
  cursor?: number;
}

export interface PendingTransfer {
  chainRef: ChainRef;
  fromWalletId: string;
  toAddress: string;
  /** EVM: calldata hex. Solana: JSON in extra_metadata or empty for native SOL. */
  data: string;
  /** EVM: wei. Solana: lamports. */
  valueAmount: string;
  extraMetadata?: Record<string, unknown>;
}

export interface ChainAdapter {
  readonly chainFamily: ChainFamily;

  createWallet(label: string): Promise<CreateWalletResult>;

  /** Decrypt key and return a family-specific signer (internal; not exported via REST). */
  getSigner(walletId: string, chainRef: ChainRef): Promise<unknown>;

  getBalance(address: string, chainRef: ChainRef): Promise<string>;

  estimateFee(pending: PendingTransfer): Promise<FeeEstimate>;

  signAndSend(pending: PendingTransfer): Promise<SendResult>;

  confirmTx(txHash: string, chainRef: ChainRef): Promise<ConfirmResult>;
}
```

### EvmAdapter (behavior-preserving)

| Method | Implementation |
|---|---|
| `createWallet` | Move body of `createBackendWallet()` — `Wallet.createRandom()`, `encryptSecret(privateKey)`, `key_type='local'`, `chain_family='evm'`. |
| `getSigner` | Current `getSignerForWallet()` + `getProvider(chainId)`. |
| `getBalance` | `provider.getBalance(address)`. |
| `estimateFee` | Current txWorker fee/gas path (`getFeeData`, `estimateGas`). |
| `signAndSend` | Current txWorker send path + `NonceManager`. |
| `confirmTx` | `provider.waitForTransaction(hash, 1)`. |

Existing `crypto.ts` (**AES-256-GCM**, `WALLET_ENCRYPTION_KEY`) is unchanged.
EVM private keys remain hex strings in ciphertext.

### SolanaAdapter (new)

| Method | Implementation |
|---|---|
| `createWallet` | `@solana/web3.js` `Keypair.generate()`. Store **base58-encoded 64-byte secret key** (or JSON byte array) encrypted via same `encryptSecret()`. `key_type='solana_local'`, `chain_family='solana'`. Address = `keypair.publicKey.toBase58()`. |
| `getSigner` | Decrypt → `Keypair.fromSecretKey(...)`. Return `{ keypair, connection }`. |
| `getBalance` | `connection.getBalance(PublicKey)` → lamports string. |
| `estimateFee` | `getLatestBlockhash` + `getFeeForMessage` on a draft `Transaction`. |
| `signAndSend` | Build `Transaction`: native SOL `SystemProgram.transfer` and/or SPL `createTransferInstruction` (when `extraMetadata.splMint` + `amount` present). Sign with backend keypair, `sendRawTransaction`, return signature base58. **No nonce manager** — Solana uses recent blockhash + optional durable nonce (out of scope for v1; retry on blockhash expired). |
| `confirmTx` | Poll `getSignatureStatuses` until `confirmed`/`finalized` or err. Map Solana execution failure → `reverted`. Return slot as `cursor`. |

**Wallet family enforcement:** `enqueueTransaction` validates
`wallet.chain_family === chain.chainFamily`. An EVM wallet cannot send on Solana.

**Key type column:** Extend `key_type` values; adapter picks decoder by
`chain_family` + `key_type`, not address format alone.

---

## 3. Transaction worker routing

### Current flow (`txWorker.ts`)

Hard-coded EVM: `getProvider` → `getSignerForWallet` → `NonceManager` →
`sendTransaction` → `waitForTransaction`.

### Proposed flow

```typescript
async function processTransaction(tx: TransactionRecord): Promise<void> {
  const chainRef = { chainFamily: tx.chain_family, chainId: tx.chain_id };
  const adapter = getAdapter(chainRef);

  try {
    const pending: PendingTransfer = {
      chainRef,
      fromWalletId: tx.from_wallet_id,
      toAddress: tx.to_address,
      data: tx.data,
      valueAmount: tx.value_wei,
      extraMetadata: tx.extra_metadata ? JSON.parse(tx.extra_metadata) : undefined,
    };

    const fee = await adapter.estimateFee(pending);
    const sent = await adapter.signAndSend(pending);

    await markSent(tx.id, {
      txHash: sent.txHash,
      nonce: sent.nonce,
      gasLimit: fee.gasLimit,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFee: fee.maxPriorityFee,
    });

    confirmTransaction(tx.id, sent.txHash, chainRef, adapter).catch(...);
  } catch (err) {
    // EvmAdapter: existing nonce release/reconcile on failure
    // SolanaAdapter: no nonce release; retry on blockhash expired
    ...
  }
}
```

`getAdapter()` resolves via `chainRef.chainFamily`:

```typescript
const adapters: Record<ChainFamily, ChainAdapter> = {
  evm: evmAdapter,
  solana: solanaAdapter,
};
```

`NonceManager` moves inside `EvmAdapter` only (not instantiated at worker top
level). Solana retry policy reuses existing `retry_count` / `MAX_RETRIES`; add
Solana-specific transient errors (`BlockhashNotFound`) to requeue list.

**Confirmation watcher:** Parameterized by adapter:

```typescript
async function confirmTransaction(
  txId: string,
  hash: string,
  chainRef: ChainRef,
  adapter: ChainAdapter
): Promise<void> {
  const result = await Promise.race([
    adapter.confirmTx(hash, chainRef),
    timeout(CONFIRMATION_TIMEOUT_MS),
  ]);
  if (result?.status === "mined") await markMined(txId, result.cursor);
  ...
}
```

---

## 4. Insight: Solana indexing

### Problem

Phase 5 indexer (`apps/insight/src/services/indexer.ts`) is EVM-specific:

- `provider.getLogs({ topics: [...] })` — **no Solana equivalent**
- ERC-20/721/1155 Transfer topic decoding
- Block-number cursor + block-hash reorg check

Solana has **slots**, **transactions** with **instructions**, and **meta
pre/post token balances** — not EVM event logs.

### Proposed architecture

```
apps/insight/src/indexers/
  types.ts           # ChainIndexer interface
  evmIndexer.ts      # move current indexChain() logic
  solanaIndexer.ts   # new
  registry.ts        # getIndexer(chainFamily)
```

```typescript
export interface ChainIndexer {
  chainFamily: ChainFamily;
  indexChain(chainRef: ChainRef, connection: Connection): Promise<void>;
  detectReorg?(chainRef: ChainRef, connection: Connection): Promise<number | null>;
}
```

Worker loop (`indexerWorker.ts`):

```typescript
for (const chain of listChains()) {
  const indexer = getIndexer(chain.chainFamily);
  const client = getChainClient(chain); // JsonRpcProvider | Connection
  await indexer.indexChain(
    { chainFamily: chain.chainFamily, chainId: chain.chainId },
    client
  );
}
```

### EvmIndexer

Move existing `indexChain`, `detectReorg`, `rollbackFromBlock` unchanged.
Cursor = block number; reorg = block hash mismatch (current behavior).

### SolanaIndexer (Phase 9 scope)

**Cursor:** `last_indexed_cursor` = last processed **slot** (not block).

**Poll loop:**

1. `getSlot(commitment)` → `safeHead = head - confirmations` (config
   `INSIGHT_CONFIRMATIONS`, default 32 slots for Solana vs 3 blocks EVM).
2. Fetch slot range in chunks (`INSIGHT_SLOT_CHUNK`, default 100).
3. For each slot: `getBlock(slot, { maxSupportedTransactionVersion: 0, transactionDetails: "full", rewards: false })`.
4. For each transaction in block:
   - Parse **native SOL** transfers: `SystemProgram.transfer` instructions.
   - Parse **SPL Token** transfers: Token / Token-2022 `Transfer` / `TransferChecked` via `transaction.meta.preTokenBalances` / `postTokenBalances` diff (more reliable than raw instruction decode).
5. Insert normalized rows into `events`:

| Column | EVM meaning | Solana meaning |
|---|---|---|
| `block_number` | block height | **slot** |
| `block_hash` | block hash | blockhash string |
| `tx_hash` | 0x tx hash | base58 signature |
| `log_index` | log index | **instruction index** (or 0 + inner index encoded) |
| `contract_address` | token contract | **mint address** (SPL) or `11111111111111111111111111111111` for native SOL |
| `event_name` | `Transfer` | `Transfer` (SPL) or `SolTransfer` (native) |
| `decoded_args_json` | `{ from, to, value }` | `{ from, to, value, mint? }` base58 addresses |

**Idempotency:** Unique on `(chain_family, chain_id, tx_hash, log_index)` (same
constraint, extended PK scope).

**Reorg / finality:** Solana reorgs are shallow but real on non-finalized
commitments. Phase 9 approach:

- Index at `confirmed` or `finalized` commitment (env per chain).
- Store slot → blockhash in `indexer_cursors`.
- On hash mismatch during lookback (`INSIGHT_REORG_CHECK_DEPTH` slots), delete
  `events` with `block_number >= reorgSlot` and rewind cursor.

**Do not** port `eth_getLogs` semantics. Query API changes:

- `getTokenBalances(chainRef, address)` — for Solana, aggregate SPL `Transfer`
  events where mint is indexed; addresses compared as base58 (case-sensitive).
- `normalizeAddress()` splits into `normalizeEvmAddress` / pass-through base58.
- NFT / ERC-1155 Insight routes remain **EVM-only** in Phase 9 (return empty or
  400 for `chainFamily=solana`).

**Platform export:** Add `getConnection(chainRef)` alongside `getProvider` in
`apps/engine/src/platform/index.ts` (or a new `chainClients.ts`).

---

## 5. API & SDK surface changes

### Engine REST

| Route | Change |
|---|---|
| `GET /chain` | Add `chainFamily`; `chainId` becomes string. |
| `POST /transaction/send` | Body: `{ chainFamily?, chainId }` (chainId string or number for EVM compat). Family-specific address validation. Solana: `toAddress` base58; `valueWei` = lamports; `data` optional; `metadata.splMint` for SPL. |
| `GET /backend-wallet/:id/balance` | Query: `chainFamily` + `chainId`. Response: `{ balance, unit: "wei" \| "lamports" }`. |
| `POST /backend-wallet/create` | Optional `chainFamily` (default `evm`). |
| `/contract/*` | Reject or 400 when `chainFamily !== "evm"`. |
| `/auth/siwe/*` | EVM-only (unchanged). |
| `/bridge/*` | EVM-only (unchanged). |

### `packages/sdk`

- `ChainConfig`: `{ chainFamily, chainId: string, name, rpcUrl }`.
- `TransactionRecord`: add `chain_family`; `chain_id` as string in types (DB
  snake_case preserved in JSON).
- Helpers: `isEvmAddress(s)`, `isSolanaAddress(s)`, `formatTxHash(hash, family)`,
  `formatAddress(addr, family)`.
- `transactions.send` accepts `chainFamily` + string `chainId`.

### Dashboard

- **Chains page:** columns Family | Chain ID | Name | RPC.
- **Transactions / Wallets:** show family badge; truncate base58/hex appropriately.
- **Contracts / Bridge / SIWE:** unchanged; EVM-only labels where relevant.
- **Insight page:** chain selector uses composite key; hide NFT tab fields for Solana.

---

## 6. Implementation order (post-approval)

1. **Migration + ChainConfig loader** — family column, string chain_id, env
   pattern; `listChains()` returns family (all existing tests green).
2. **ChainAdapter + EvmAdapter refactor** — extract from `wallets.ts` /
   `txWorker.ts` with zero EVM behavior change; `nonceManager.test.ts` still passes.
3. **SolanaAdapter** — wallet create, balance, SOL transfer, SPL transfer,
   confirm; wire into worker via registry.
4. **REST + validation** — transaction send, wallet create/balance, chain list.
5. **Insight EvmIndexer extraction + SolanaIndexer** — slot cursor, SPL/native
   transfers, balance query path.
6. **SDK + Dashboard** — types, formatters, Chains page.

**Dependencies:** add `@solana/web3.js`, `@solana/spl-token` to `apps/engine` (and
Insight if indexer imports them directly).

**Tests to add:**

- SolanaAdapter unit tests (mock Connection).
- Address validation per family.
- Migration backfill snapshot test.
- EvmAdapter regression: existing `nonceManager.test.ts`, webhook tests unchanged.

---

## 7. Out of scope (explicit)

- Solana program deploy / Anchor / IDL registry
- Contract read/write routes for Solana
- SIWE or Connect auth on Solana
- CDP Bridge / swap on Solana
- Durable nonce accounts, versioned transactions v0 advanced features
- Mobile / Unity / Unreal SDK updates (follow-up after Engine stabilizes)

---

## 8. Risks & open questions

| # | Question | Recommendation |
|---|---|---|
| 1 | **API breaking change:** `chainId` number → string? | Accept both on input for EVM; output always string + `chainFamily`. Document in Engine README. |
| 2 | **Solana env `<id>`:** `devnet` vs numeric alias `900001`? | Use readable cluster slug in env (`CHAIN_devnet_*`); avoids collision with EVM numeric IDs. |
| 3 | **`value_wei` column name for lamports?** | Keep column name; document as "smallest unit" in API (`unit` field in responses). Rename column later if desired. |
| 4 | **One Engine DB for mixed families?** | Yes — same Postgres; family column discriminates. |
| 5 | **Insight NFT routes on Solana?** | Return `400` with clear message in Phase 9; Metaplex indexing is a later phase. |
| 6 | **Wallet per family vs universal?** | **Per family** — different curves require separate keys. |

---

## 9. Approval checklist

- [ ] Composite `{ chainFamily, chainId: string }` model approved
- [ ] DB migration strategy (backfill `evm`, text chain_id) approved
- [ ] Env var pattern (`CHAIN_<id>_FAMILY`, alphanumeric `<id>`) approved
- [ ] ChainAdapter interface + EvmAdapter extraction approach approved
- [ ] SolanaIndexer slot-based design (not getLogs) approved
- [ ] Phase 9 scope boundary (no programs/deploy) confirmed

**Reviewer:** sign off above before implementation begins.
