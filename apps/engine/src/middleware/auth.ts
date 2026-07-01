import type { Request, Response, NextFunction } from "express";
import { verifyApiKey } from "../services/apiKeys.js";

// Augment Express's Request type so downstream handlers can read who called.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyId?: string;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Auth for all regular Engine endpoints (wallets, transactions, chains).
 * Checks, in order:
 *   1. The database-backed api_keys table (hashed, revocable, per-customer).
 *   2. The legacy ENGINE_ACCESS_KEYS static allowlist, kept only for
 *      backward compatibility with v0 setups that haven't issued DB keys
 *      yet. New integrations should use `apkaya apikey create` instead.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({ error: "Unauthorized. Provide a valid Authorization: Bearer <key> header." });
    return;
  }

  const dbKey = verifyApiKey(token);
  if (dbKey) {
    req.apiKeyId = dbKey.id;
    next();
    return;
  }

  const legacyKeys = (process.env.ENGINE_ACCESS_KEYS || "").split(",").map((k) => k.trim());
  if (legacyKeys.includes(token)) {
    next();
    return;
  }

  res.status(401).json({ error: "Invalid or revoked API key." });
}

/**
 * Auth for key-management endpoints (/api-key/*). Requires the single
 * master ENGINE_ADMIN_KEY, never a customer-issued key — this avoids the
 * chicken-and-egg problem of needing a DB key to create DB keys, and keeps
 * customer keys unable to mint or revoke other keys even if leaked.
 */
export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  const adminKey = process.env.ENGINE_ADMIN_KEY;

  if (!adminKey) {
    res.status(500).json({ error: "ENGINE_ADMIN_KEY is not configured on this Engine instance." });
    return;
  }

  if (!token || token !== adminKey) {
    res.status(401).json({ error: "Unauthorized. Key management requires the Engine admin key." });
    return;
  }

  next();
}
