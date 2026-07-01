import crypto from "node:crypto";

export interface SessionJwtPayload {
  sub: string;
  address: string;
  backendWalletId: string | null;
  authMethod: "email" | "siwe";
}

function getSecret(): Buffer {
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_JWT_SECRET must be set (min 32 chars). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(secret, "utf-8");
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function signSessionJwt(payload: SessionJwtPayload, ttlSeconds: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", getSecret()).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export function verifySessionJwt(token: string): SessionJwtPayload & { exp: number; iat: number } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid session token.");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto.createHmac("sha256", getSecret()).update(signingInput).digest();
  const actual = base64UrlDecode(encodedSignature);

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error("Invalid session token signature.");
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf-8")) as { alg?: string };
  if (header.alg !== "HS256") throw new Error("Unsupported session token algorithm.");

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf-8")) as SessionJwtPayload & {
    exp?: number;
    iat?: number;
  };

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session token expired.");
  }

  if (!payload.sub || !payload.address || !payload.authMethod) {
    throw new Error("Malformed session token.");
  }

  return payload as SessionJwtPayload & { exp: number; iat: number };
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function sessionTtlSeconds(): number {
  return Number(process.env.SESSION_JWT_TTL_SECONDS ?? 86_400 * 7);
}
