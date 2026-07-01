/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("indexer_state", {
    chain_id: { type: "integer", primaryKey: true },
    last_indexed_block: { type: "bigint", notNull: true, default: 0 },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createTable("indexer_block_hashes", {
    chain_id: { type: "integer", notNull: true },
    block_number: { type: "bigint", notNull: true },
    block_hash: { type: "text", notNull: true },
    recorded_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("indexer_block_hashes", "indexer_block_hashes_pkey", {
    primaryKey: ["chain_id", "block_number"],
  });

  pgm.createIndex("indexer_block_hashes", ["chain_id", "block_number"], {
    name: "idx_indexer_block_hashes_chain_block",
  });

  pgm.createTable("events", {
    id: { type: "bigserial", primaryKey: true },
    chain_id: { type: "integer", notNull: true },
    block_number: { type: "bigint", notNull: true },
    block_hash: { type: "text", notNull: true },
    tx_hash: { type: "text", notNull: true },
    log_index: { type: "integer", notNull: true },
    contract_address: { type: "text", notNull: true },
    event_name: { type: "text", notNull: true },
    decoded_args_json: { type: "jsonb", notNull: true },
    indexed_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("events", ["chain_id", "block_number"], { name: "idx_events_chain_block" });
  pgm.createIndex("events", ["chain_id", "contract_address"], { name: "idx_events_chain_contract" });
  pgm.createIndex("events", ["chain_id", "event_name"], { name: "idx_events_chain_event" });
  pgm.createIndex("events", ["chain_id", "tx_hash"], { name: "idx_events_chain_tx" });

  pgm.createIndex("events", ["chain_id", "tx_hash", "log_index"], {
    name: "idx_events_idempotent",
    unique: true,
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable("events");
  pgm.dropTable("indexer_block_hashes");
  pgm.dropTable("indexer_state");
};
