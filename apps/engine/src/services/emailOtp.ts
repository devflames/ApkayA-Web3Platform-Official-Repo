import crypto from "node:crypto";
import { nanoid } from "nanoid";
import pino from "pino";
import { execute, queryOne } from "../db/index.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "engine:auth" });

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_LENGTH = 6;

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(OTP_LENGTH, "0");
}

export async function requestEmailOtp(email: string): Promise<{ expiresAt: string; devCode?: string }> {
  const normalized = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Invalid email address.");
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const id = nanoid();

  await execute(
    `INSERT INTO email_otp_codes (id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [id, normalized, hashOtp(code), expiresAt]
  );

  if (process.env.ENGINE_AUTH_DEV_LOG_OTP === "true") {
    log.info({ email: normalized, code }, "DEV email OTP (not sent via mail provider)");
    return { expiresAt, devCode: code };
  }

  // Production: integrate SMTP / SendGrid / etc. For v0 we log a warning.
  log.warn(
    { email: normalized },
    "Email OTP generated but no mail provider configured — set ENGINE_AUTH_DEV_LOG_OTP=true for local dev"
  );

  return { expiresAt };
}

export async function verifyEmailOtp(email: string, code: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const row = await queryOne<{ id: string; code_hash: string; expires_at: Date; used_at: Date | null }>(
    `SELECT id, code_hash, expires_at, used_at
     FROM email_otp_codes
     WHERE email = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalized]
  );

  if (!row) throw new Error("No active verification code for this email.");
  if (row.used_at) throw new Error("Verification code already used.");
  if (row.expires_at.getTime() < Date.now()) throw new Error("Verification code expired.");

  const expected = hashOtp(code.trim());
  const actual = Buffer.from(row.code_hash, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (expectedBuf.length !== actual.length || !crypto.timingSafeEqual(expectedBuf, actual)) {
    throw new Error("Invalid verification code.");
  }

  await execute(`UPDATE email_otp_codes SET used_at = NOW() WHERE id = $1`, [row.id]);
}
