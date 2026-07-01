/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("deployed_contracts", {
    id: { type: "text", primaryKey: true },
    chain_id: { type: "integer", notNull: true },
    address: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    abi_json: { type: "text", notNull: true },
    deployer_wallet_id: {
      type: "text",
      references: "backend_wallets(id)",
      onDelete: "SET NULL",
    },
    deployed_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    tx_id: {
      type: "text",
      references: "transactions(id)",
      onDelete: "SET NULL",
    },
  });

  pgm.createIndex("deployed_contracts", ["chain_id", "address"], {
    name: "idx_deployed_contracts_chain_address",
    unique: true,
  });
  pgm.createIndex("deployed_contracts", "chain_id", { name: "idx_deployed_contracts_chain" });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable("deployed_contracts");
};
