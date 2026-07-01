import type { Request, Response, NextFunction } from "express";
import { verifySessionJwt, type SessionJwtPayload } from "../services/sessionJwt.js";
import { resolveSessionEndUser, type EndUserRecord } from "../services/endUsers.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionPayload?: SessionJwtPayload;
      endUser?: EndUserRecord;
    }
  }
}

function extractSessionToken(req: Request): string | null {
  const header = req.headers["x-apkaya-session"];
  if (typeof header === "string" && header.length > 0) return header;
  return null;
}

export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractSessionToken(req);

  if (!token) {
    res.status(401).json({
      error: "Unauthorized. Provide X-Apkaya-Session header with a valid end-user session token.",
    });
    return;
  }

  try {
    const payload = verifySessionJwt(token);
    req.sessionPayload = payload;
    req.endUser = await resolveSessionEndUser(payload);
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid session.";
    res.status(401).json({ error: message });
  }
}
