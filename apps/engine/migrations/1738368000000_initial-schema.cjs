/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("backend_wallets", {
    id: { type: "text", primaryKey: true },
    label: { type: "text", notNull: true },
    address: { type: "text", notNull: true, unique: true },
    encrypted_key: { type: "text", notNull: true },
    key_type: { type: "text", notNull: true, default: "local" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    is_active: { type: "integer", notNull: true, default: 1 },
  });

  pgm.createTable("transactions", {
    id: { type: "text", primaryKey: true },
    idempotency_key: { type: "text" },
    chain_id: { type: "integer", notNull: true },
    from_wallet_id: {
      type: "text",
      notNull: true,
      references: "backend_wallets(id)",
    },
    to_address: { type: "text", notNull: true },
    data: { type: "text", notNull: true, default: "0x" },
    value_wei: { type: "text", notNull: true, default: "0" },
    gas_limit: { type: "text" },
    max_fee_per_gas: { type: "text" },
    max_priority_fee: { type: "text" },
    nonce: { type: "integer" },
    tx_hash: { type: "text" },
    status: { type: "text", notNull: true, default: "queued" },
    error_message: { type: "text" },
    retry_count: { type: "integer", notNull: true, default: 0 },
    extra_metadata: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    sent_at: { type: "timestamptz" },
    mined_at: { type: "timestamptz" },
    block_number: { type: "integer" },
  });

  pgm.createIndex("transactions", "idempotency_key", {
    name: "idx_tx_idempotency",
    unique: true,
    where: "idempotency_key IS NOT NULL",
  });
  pgm.createIndex("transactions", "status", { name: "idx_tx_status" });
  pgm.createIndex("transactions", "from_wallet_id", { name: "idx_tx_wallet" });
  pgm.createIndex("transactions", "chain_id", { name: "idx_tx_chain" });

  pgm.createTable("webhook_events", {
    id: { type: "text", primaryKey: true },
    transaction_id: {
      type: "text",
      notNull: true,
      references: "transactions(id)",
    },
    event_type: { type: "text", notNull: true },
    payload: { type: "text", notNull: true },
    delivered: { type: "integer", notNull: true, default: 0 },
    attempts: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createTable("api_keys", {
    id: { type: "text", primaryKey: true },
    label: { type: "text", notNull: true },
    key_prefix: { type: "text", notNull: true },
    key_hash: { type: "text", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    last_used_at: { type: "timestamptz" },
    revoked_at: { type: "timestamptz" },
    is_active: { type: "integer", notNull: true, default: 1 },
  });

  pgm.createIndex("api_keys", "is_active", { name: "idx_api_keys_active" });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable("webhook_events");
  pgm.dropTable("transactions");
  pgm.dropTable("api_keys");
  pgm.dropTable("backend_wallets");
};
