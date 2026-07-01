import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";

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
export function createApiKey(label: string): { record: ApiKeyRecord; rawKey: string } {
  const rawKey = generateRawKey();
  const id = nanoid();
  const keyPrefix = rawKey.slice(0, 16); // e.g. "sk_live_a1b2c3d4"

  db.prepare(
    `INSERT INTO api_keys (id, label, key_prefix, key_hash) VALUES (?, ?, ?, ?)`
  ).run(id, label, keyPrefix, hashKey(rawKey));

  const record = db.prepare(`SELECT ${SAFE_COLUMNS} FROM api_keys WHERE id = ?`).get(id) as ApiKeyRecord;
  return { record, rawKey };
}

export function listApiKeys(): ApiKeyRecord[] {
  return db.prepare(`SELECT ${SAFE_COLUMNS} FROM api_keys ORDER BY created_at DESC`).all() as ApiKeyRecord[];
}

export function getApiKey(id: string): ApiKeyRecord | undefined {
  return db.prepare(`SELECT ${SAFE_COLUMNS} FROM api_keys WHERE id = ?`).get(id) as ApiKeyRecord | undefined;
}

export function revokeApiKey(id: string): boolean {
  const result = db
    .prepare(`UPDATE api_keys SET is_active = 0, revoked_at = datetime('now') WHERE id = ? AND is_active = 1`)
    .run(id);
  return result.changes > 0;
}

export function reactivateApiKey(id: string): boolean {
  const result = db
    .prepare(`UPDATE api_keys SET is_active = 1, revoked_at = NULL WHERE id = ? AND is_active = 0`)
    .run(id);
  return result.changes > 0;
}

/**
 * Verifies a raw key against stored hashes. On success, updates
 * last_used_at (best-effort, not awaited by callers) and returns the
 * matching record. Returns undefined for unknown, revoked, or malformed keys.
 */
export function verifyApiKey(rawKey: string): ApiKeyRecord | undefined {
  if (!rawKey.startsWith("sk_live_")) return undefined;

  const hash = hashKey(rawKey);
  const row = db
    .prepare(`SELECT ${SAFE_COLUMNS} FROM api_keys WHERE key_hash = ? AND is_active = 1`)
    .get(hash) as ApiKeyRecord | undefined;

  if (row) {
    db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(row.id);
  }

  return row;
}
