/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable("end_users", {
    id: { type: "text", primaryKey: true },
    email: { type: "text", unique: true },
    primary_address: { type: "text", notNull: true },
    backend_wallet_id: {
      type: "text",
      references: "backend_wallets(id)",
      onDelete: "SET NULL",
    },
    auth_method: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("end_users", "primary_address", { name: "idx_end_users_address" });

  pgm.createTable("end_user_sessions", {
    id: { type: "text", primaryKey: true },
    end_user_id: {
      type: "text",
      notNull: true,
      references: "end_users(id)",
      onDelete: "CASCADE",
    },
    token_hash: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("end_user_sessions", "end_user_id", { name: "idx_end_user_sessions_user" });
  pgm.createIndex("end_user_sessions", "expires_at", { name: "idx_end_user_sessions_expires" });

  pgm.createTable("siwe_nonces", {
    nonce: { type: "text", primaryKey: true },
    address: { type: "text", notNull: true },
    chain_id: { type: "integer", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    used_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createTable("email_otp_codes", {
    id: { type: "text", primaryKey: true },
    email: { type: "text", notNull: true },
    code_hash: { type: "text", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    used_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("email_otp_codes", "email", { name: "idx_email_otp_email" });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable("email_otp_codes");
  pgm.dropTable("siwe_nonces");
  pgm.dropTable("end_user_sessions");
  pgm.dropTable("end_users");
};
