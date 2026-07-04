/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // --- backend_wallets ---
  pgm.addColumn("backend_wallets", {
    chain_family: { type: "text", notNull: true, default: "evm" },
  });
  pgm.dropConstraint("backend_wallets", "backend_wallets_address_key", { ifExists: true });
  pgm.createIndex("backend_wallets", ["chain_family", "address"], {
    name: "idx_backend_wallets_family_address",
    unique: true,
  });

  // --- transactions ---
  pgm.addColumn("transactions", {
    chain_family: { type: "text", notNull: true, default: "evm" },
  });
  pgm.alterColumn("transactions", "chain_id", { type: "text", using: "chain_id::text" });
  pgm.dropIndex("transactions", "idx_tx_chain", { ifExists: true });
  pgm.createIndex("transactions", ["chain_family", "chain_id"], { name: "idx_tx_chain" });

  // --- deployed_contracts ---
  pgm.addColumn("deployed_contracts", {
    chain_family: { type: "text", notNull: true, default: "evm" },
  });
  pgm.alterColumn("deployed_contracts", "chain_id", { type: "text", using: "chain_id::text" });
  pgm.dropIndex("deployed_contracts", "idx_deployed_contracts_chain_address", { ifExists: true });
  pgm.createIndex("deployed_contracts", ["chain_family", "chain_id", "address"], {
    name: "idx_deployed_contracts_chain_address",
    unique: true,
  });

  // --- siwe_nonces (EVM-only auth; migrate for consistency) ---
  pgm.addColumn("siwe_nonces", {
    chain_family: { type: "text", notNull: true, default: "evm" },
  });
  pgm.alterColumn("siwe_nonces", "chain_id", { type: "text", using: "chain_id::text" });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.alterColumn("siwe_nonces", "chain_id", { type: "integer", using: "chain_id::integer" });
  pgm.dropColumn("siwe_nonces", "chain_family");

  pgm.dropIndex("deployed_contracts", "idx_deployed_contracts_chain_address", { ifExists: true });
  pgm.alterColumn("deployed_contracts", "chain_id", { type: "integer", using: "chain_id::integer" });
  pgm.dropColumn("deployed_contracts", "chain_family");
  pgm.createIndex("deployed_contracts", ["chain_id", "address"], {
    name: "idx_deployed_contracts_chain_address",
    unique: true,
  });

  pgm.dropIndex("transactions", "idx_tx_chain", { ifExists: true });
  pgm.alterColumn("transactions", "chain_id", { type: "integer", using: "chain_id::integer" });
  pgm.dropColumn("transactions", "chain_family");
  pgm.createIndex("transactions", "chain_id", { name: "idx_tx_chain" });

  pgm.dropIndex("backend_wallets", "idx_backend_wallets_family_address", { ifExists: true });
  pgm.dropColumn("backend_wallets", "chain_family");
  pgm.addConstraint("backend_wallets", "backend_wallets_address_key", { unique: ["address"] });
};
