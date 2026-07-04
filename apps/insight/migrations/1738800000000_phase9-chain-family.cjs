/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn("indexer_state", {
    chain_family: { type: "text", notNull: true, default: "evm" },
  });
  pgm.addColumn("indexer_state", {
    chain_id_text: { type: "text" },
  });
  pgm.sql("UPDATE indexer_state SET chain_id_text = chain_id::text");
  pgm.alterColumn("indexer_state", "chain_id_text", { notNull: true });
  pgm.dropConstraint("indexer_state", "indexer_state_pkey");
  pgm.dropColumn("indexer_state", "chain_id");
  pgm.renameColumn("indexer_state", "chain_id_text", "chain_id");
  pgm.renameColumn("indexer_state", "last_indexed_block", "last_indexed_cursor");
  pgm.addConstraint("indexer_state", "indexer_state_pkey", {
    primaryKey: ["chain_family", "chain_id"],
  });

  pgm.addColumn("indexer_block_hashes", {
    chain_family: { type: "text", notNull: true, default: "evm" },
  });
  pgm.addColumn("indexer_block_hashes", {
    chain_id_text: { type: "text" },
  });
  pgm.sql("UPDATE indexer_block_hashes SET chain_id_text = chain_id::text");
  pgm.alterColumn("indexer_block_hashes", "chain_id_text", { notNull: true });
  pgm.dropConstraint("indexer_block_hashes", "indexer_block_hashes_pkey");
  pgm.dropColumn("indexer_block_hashes", "chain_id");
  pgm.renameColumn("indexer_block_hashes", "chain_id_text", "chain_id");
  pgm.addConstraint("indexer_block_hashes", "indexer_block_hashes_pkey", {
    primaryKey: ["chain_family", "chain_id", "block_number"],
  });

  pgm.addColumn("events", {
    chain_family: { type: "text", notNull: true, default: "evm" },
  });
  pgm.addColumn("events", {
    chain_id_text: { type: "text" },
  });
  pgm.sql("UPDATE events SET chain_id_text = chain_id::text");
  pgm.alterColumn("events", "chain_id_text", { notNull: true });
  pgm.dropIndex("events", "idx_events_idempotent", { ifExists: true });
  pgm.dropColumn("events", "chain_id");
  pgm.renameColumn("events", "chain_id_text", "chain_id");
  pgm.createIndex("events", ["chain_family", "chain_id", "tx_hash", "log_index"], {
    name: "idx_events_idempotent",
    unique: true,
  });
  pgm.dropIndex("events", "idx_events_chain_block", { ifExists: true });
  pgm.createIndex("events", ["chain_family", "chain_id", "block_number"], {
    name: "idx_events_chain_block",
  });
  pgm.dropIndex("events", "idx_events_chain_contract", { ifExists: true });
  pgm.createIndex("events", ["chain_family", "chain_id", "contract_address"], {
    name: "idx_events_chain_contract",
  });
  pgm.dropIndex("events", "idx_events_chain_event", { ifExists: true });
  pgm.createIndex("events", ["chain_family", "chain_id", "event_name"], {
    name: "idx_events_chain_event",
  });
  pgm.dropIndex("events", "idx_events_chain_tx", { ifExists: true });
  pgm.createIndex("events", ["chain_family", "chain_id", "tx_hash"], {
    name: "idx_events_chain_tx",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex("events", "idx_events_chain_tx", { ifExists: true });
  pgm.createIndex("events", ["chain_id", "tx_hash"], { name: "idx_events_chain_tx" });
  pgm.dropIndex("events", "idx_events_chain_event", { ifExists: true });
  pgm.createIndex("events", ["chain_id", "event_name"], { name: "idx_events_chain_event" });
  pgm.dropIndex("events", "idx_events_chain_contract", { ifExists: true });
  pgm.createIndex("events", ["chain_id", "contract_address"], { name: "idx_events_chain_contract" });
  pgm.dropIndex("events", "idx_events_chain_block", { ifExists: true });
  pgm.createIndex("events", ["chain_id", "block_number"], { name: "idx_events_chain_block" });
  pgm.dropIndex("events", "idx_events_idempotent", { ifExists: true });
  pgm.renameColumn("events", "chain_id", "chain_id_text");
  pgm.addColumn("events", { chain_id: { type: "integer" } });
  pgm.sql("UPDATE events SET chain_id = chain_id_text::integer");
  pgm.alterColumn("events", "chain_id", { notNull: true });
  pgm.dropColumn("events", "chain_id_text");
  pgm.dropColumn("events", "chain_family");
  pgm.createIndex("events", ["chain_id", "tx_hash", "log_index"], {
    name: "idx_events_idempotent",
    unique: true,
  });

  pgm.dropConstraint("indexer_block_hashes", "indexer_block_hashes_pkey");
  pgm.renameColumn("indexer_block_hashes", "chain_id", "chain_id_text");
  pgm.addColumn("indexer_block_hashes", { chain_id: { type: "integer" } });
  pgm.sql("UPDATE indexer_block_hashes SET chain_id = chain_id_text::integer");
  pgm.alterColumn("indexer_block_hashes", "chain_id", { notNull: true });
  pgm.dropColumn("indexer_block_hashes", "chain_id_text");
  pgm.dropColumn("indexer_block_hashes", "chain_family");
  pgm.addConstraint("indexer_block_hashes", "indexer_block_hashes_pkey", {
    primaryKey: ["chain_id", "block_number"],
  });

  pgm.dropConstraint("indexer_state", "indexer_state_pkey");
  pgm.renameColumn("indexer_state", "last_indexed_cursor", "last_indexed_block");
  pgm.renameColumn("indexer_state", "chain_id", "chain_id_text");
  pgm.addColumn("indexer_state", { chain_id: { type: "integer" } });
  pgm.sql("UPDATE indexer_state SET chain_id = chain_id_text::integer");
  pgm.alterColumn("indexer_state", "chain_id", { notNull: true });
  pgm.dropColumn("indexer_state", "chain_id_text");
  pgm.dropColumn("indexer_state", "chain_family");
  pgm.addConstraint("indexer_state", "indexer_state_pkey", { primaryKey: "chain_id" });
};
