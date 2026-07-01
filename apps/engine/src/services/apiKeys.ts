import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { execute, query, queryOne } from "../db/index.js";
import { serializeRow, serializeRows } from "../db/serialize.js";

export interface ApiKeyRecord {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: number;
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Generates a new raw key in the form `sk_live_<40 hex chars>`. */
function generateRawKey(): string {
  return `sk_live_${crypto.randomBytes(20).toString("hex")}`;
}

const SAFE_COLUMNS = "id, label, key_prefix, created_at, last_used_at, revoked_at, is_active";

/**
 * Creates a new API key. The raw key is returned exactly once — only its
 * SHA-256 hash and a display prefix are persisted. There is no way to
 * recover the raw value later, matching how real key-issuance systems
 * (Stripe, thirdweb, etc.) behave.
 */
export async function createApiKey(label: string): Promise<{ record: ApiKeyRecord; rawKey: string }> {
  const rawKey = generateRawKey();
  const id = nanoid();
  const keyPrefix = rawKey.slice(0, 16);

  await execute(
    `INSERT INTO api_keys (id, label, key_prefix, key_hash) VALUES ($1, $2, $3, $4)`,
    [id, label, keyPrefix, hashKey(rawKey)]
  );

  const record = await queryOne<ApiKeyRecord>(
    `SELECT ${SAFE_COLUMNS} FROM api_keys WHERE id = $1`,
    [id]
  );
  if (!record) throw new Error("Failed to create API key.");
  return { record: serializeRow(record), rawKey };
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const rows = await query<ApiKeyRecord>(
    `SELECT ${SAFE_COLUMNS} FROM api_keys ORDER BY created_at DESC`
  );
  return serializeRows(rows);
}

export async function getApiKey(id: string): Promise<ApiKeyRecord | undefined> {
  const row = await queryOne<ApiKeyRecord>(
    `SELECT ${SAFE_COLUMNS} FROM api_keys WHERE id = $1`,
    [id]
  );
  return row ? serializeRow(row) : undefined;
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const changes = await execute(
    `UPDATE api_keys SET is_active = 0, revoked_at = NOW() WHERE id = $1 AND is_active = 1`,
    [id]
  );
  return changes > 0;
}

export async function reactivateApiKey(id: string): Promise<boolean> {
  const changes = await execute(
    `UPDATE api_keys SET is_active = 1, revoked_at = NULL WHERE id = $1 AND is_active = 0`,
    [id]
  );
  return changes > 0;
}

/**
 * Verifies a raw key against stored hashes. On success, updates
 * last_used_at (best-effort) and returns the matching record.
 */
export async function verifyApiKey(rawKey: string): Promise<ApiKeyRecord | undefined> {
  if (!rawKey.startsWith("sk_live_")) return undefined;

  const hash = hashKey(rawKey);
  const row = await queryOne<ApiKeyRecord>(
    `SELECT ${SAFE_COLUMNS} FROM api_keys WHERE key_hash = $1 AND is_active = 1`,
    [hash]
  );

  if (row) {
    await execute(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]);
  }

  return row ? serializeRow(row) : undefined;
}
