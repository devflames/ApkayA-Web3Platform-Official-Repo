import type { Request, Response, NextFunction } from "express";
import { verifyApiKey } from "../services/apiKeys.js";

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

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({ error: "Unauthorized. Provide a valid Authorization: Bearer <key> header." });
    return;
  }

  const dbKey = await verifyApiKey(token);
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
