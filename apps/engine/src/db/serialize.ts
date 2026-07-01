const TIMESTAMP_FIELDS = new Set([
  "created_at",
  "updated_at",
  "sent_at",
  "mined_at",
  "last_used_at",
  "revoked_at",
  "deployed_at",
]);

/** Normalizes pg row values to match the legacy SQLite API response shape. */
export function serializeRow<T>(row: T): T {
  if (!row || typeof row !== "object") return row;

  const out = { ...(row as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (value instanceof Date && TIMESTAMP_FIELDS.has(key)) {
      out[key] = value.toISOString();
    }
  }
  return out as T;
}

export function serializeRows<T>(rows: T[]): T[] {
  return rows.map(serializeRow);
}
