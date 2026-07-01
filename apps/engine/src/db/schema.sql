-- Engine schema (v0). Designed to be a near-drop-in port to Postgres later:
-- swap AUTOINCREMENT -> SERIAL/IDENTITY, TEXT timestamps -> TIMESTAMPTZ, etc.

CREATE TABLE IF NOT EXISTS backend_wallets (
  id              TEXT PRIMARY KEY,        -- nanoid
  label           TEXT NOT NULL,
  address         TEXT NOT NULL UNIQUE,
  encrypted_key   TEXT NOT NULL,           -- AES-256-GCM ciphertext (iv:tag:data)
  key_type        TEXT NOT NULL DEFAULT 'local', -- 'local' | 'kms' (future)
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS transactions (
  id                  TEXT PRIMARY KEY,    -- nanoid, returned to caller immediately
  idempotency_key     TEXT,                -- optional, dedupes client retries
  chain_id            INTEGER NOT NULL,
  from_wallet_id      TEXT NOT NULL REFERENCES backend_wallets(id),
  to_address          TEXT NOT NULL,
  data                TEXT NOT NULL DEFAULT '0x',
  value_wei           TEXT NOT NULL DEFAULT '0',
  gas_limit           TEXT,                -- estimated, nullable until queued
  max_fee_per_gas     TEXT,
  max_priority_fee    TEXT,
  nonce               INTEGER,             -- assigned at send time
  tx_hash             TEXT,
  status              TEXT NOT NULL DEFAULT 'queued',
    -- queued -> sent -> mined  (happy path)
    --        -> errored / cancelled / reverted
  error_message       TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  extra_metadata      TEXT,                -- JSON blob, caller-supplied context
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at             TEXT,
  mined_at            TEXT,
  block_number        INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_idempotency
  ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_tx_chain ON transactions(chain_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id              TEXT PRIMARY KEY,
  transaction_id  TEXT NOT NULL REFERENCES transactions(id),
  event_type      TEXT NOT NULL,    -- 'tx.sent' | 'tx.mined' | 'tx.errored'
  payload         TEXT NOT NULL,    -- JSON
  delivered       INTEGER NOT NULL DEFAULT 0,
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  key_prefix      TEXT NOT NULL,          -- first 12 chars of the raw key, shown in lists for identification
  key_hash        TEXT NOT NULL UNIQUE,   -- sha256(raw key), the raw key is never stored
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at    TEXT,
  revoked_at      TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
