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
  rate_limit_per_minute: number | null;
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function generateRawKey(): string {
  return `sk_live_${crypto.randomBytes(20).toString("hex")}`;
}

function defaultRateLimitPerMinute(): number {
  return Number(process.env.DEFAULT_API_KEY_RATE_LIMIT_PER_MINUTE ?? 120);
}

const SAFE_COLUMNS =
  "id, label, key_prefix, created_at, last_used_at, revoked_at, is_active, rate_limit_per_minute";

export async function createApiKey(
  label: string,
  rateLimitPerMinute?: number | null
): Promise<{ record: ApiKeyRecord; rawKey: string }> {
  const rawKey = generateRawKey();
  const id = nanoid();
  const keyPrefix = rawKey.slice(0, 16);

  await execute(
    `INSERT INTO api_keys (id, label, key_prefix, key_hash, rate_limit_per_minute)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, label, keyPrefix, hashKey(rawKey), rateLimitPerMinute ?? null]
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

export async function setApiKeyRateLimit(
  id: string,
  rateLimitPerMinute: number | null
): Promise<boolean> {
  const changes = await execute(
    `UPDATE api_keys SET rate_limit_per_minute = $1 WHERE id = $2`,
    [rateLimitPerMinute, id]
  );
  return changes > 0;
}

export async function getRateLimitForKey(apiKeyId: string): Promise<number> {
  const row = await queryOne<{ rate_limit_per_minute: number | null }>(
    `SELECT rate_limit_per_minute FROM api_keys WHERE id = $1 AND is_active = 1`,
    [apiKeyId]
  );
  if (!row) return defaultRateLimitPerMinute();
  return row.rate_limit_per_minute ?? defaultRateLimitPerMinute();
}

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
