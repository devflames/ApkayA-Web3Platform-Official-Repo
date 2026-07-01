/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumns("webhook_events", {
    next_attempt_at: { type: "timestamptz" },
    last_error: { type: "text" },
    delivery_status: { type: "text", notNull: true, default: "pending" },
  });

  pgm.createIndex("webhook_events", ["delivery_status", "next_attempt_at"], {
    name: "idx_webhook_events_retry",
    where: "delivery_status = 'pending'",
  });

  // Existing rows: treat delivered=1 as delivered, else pending with immediate retry.
  pgm.sql(`
    UPDATE webhook_events
    SET delivery_status = CASE WHEN delivered = 1 THEN 'delivered' ELSE 'pending' END,
        next_attempt_at = CASE WHEN delivered = 1 THEN NULL ELSE created_at END
  `);

  pgm.addColumns("api_keys", {
    rate_limit_per_minute: { type: "integer" },
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropColumns("api_keys", ["rate_limit_per_minute"]);
  pgm.dropIndex("webhook_events", [], { name: "idx_webhook_events_retry" });
  pgm.dropColumns("webhook_events", ["next_attempt_at", "last_error", "delivery_status"]);
};
