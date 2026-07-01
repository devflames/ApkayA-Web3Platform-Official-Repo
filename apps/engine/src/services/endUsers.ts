import { nanoid } from "nanoid";
import { Wallet } from "ethers";
import { execute, queryOne } from "../db/index.js";
import { serializeRow } from "../db/serialize.js";
import { encryptSecret } from "./crypto.js";
import {
  hashSessionToken,
  sessionTtlSeconds,
  signSessionJwt,
  type SessionJwtPayload,
} from "./sessionJwt.js";

export interface EndUserRecord {
  id: string;
  email: string | null;
  primary_address: string;
  backend_wallet_id: string | null;
  auth_method: string;
  created_at: string;
  updated_at: string;
}

export interface SessionIssueResult {
  sessionToken: string;
  expiresAt: string;
  endUser: EndUserRecord;
}

async function provisionInAppWallet(email: string): Promise<{ walletId: string; address: string }> {
  const wallet = Wallet.createRandom();
  const walletId = nanoid();

  await execute(
    `INSERT INTO backend_wallets (id, label, address, encrypted_key, key_type)
     VALUES ($1, $2, $3, $4, 'in_app')`,
    [walletId, `in-app:${email}`, wallet.address, encryptSecret(wallet.privateKey)]
  );

  return { walletId, address: wallet.address };
}

export async function getEndUserByEmail(email: string): Promise<EndUserRecord | undefined> {
  const row = await queryOne<EndUserRecord>(
    `SELECT id, email, primary_address, backend_wallet_id, auth_method, created_at, updated_at
     FROM end_users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return row ? serializeRow(row) : undefined;
}

export async function getEndUserByAddress(address: string): Promise<EndUserRecord | undefined> {
  const row = await queryOne<EndUserRecord>(
    `SELECT id, email, primary_address, backend_wallet_id, auth_method, created_at, updated_at
     FROM end_users WHERE LOWER(primary_address) = LOWER($1)`,
    [address]
  );
  return row ? serializeRow(row) : undefined;
}

export async function getEndUserById(id: string): Promise<EndUserRecord | undefined> {
  const row = await queryOne<EndUserRecord>(
    `SELECT id, email, primary_address, backend_wallet_id, auth_method, created_at, updated_at
     FROM end_users WHERE id = $1`,
    [id]
  );
  return row ? serializeRow(row) : undefined;
}

async function issueSession(endUser: EndUserRecord): Promise<SessionIssueResult> {
  const ttl = sessionTtlSeconds();
  const payload: SessionJwtPayload = {
    sub: endUser.id,
    address: endUser.primary_address,
    backendWalletId: endUser.backend_wallet_id,
    authMethod: endUser.auth_method as "email" | "siwe",
  };

  const sessionToken = signSessionJwt(payload, ttl);
  const sessionId = nanoid();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  await execute(
    `INSERT INTO end_user_sessions (id, end_user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, endUser.id, hashSessionToken(sessionToken), expiresAt]
  );

  return { sessionToken, expiresAt, endUser };
}

export async function upsertEmailEndUser(email: string): Promise<SessionIssueResult> {
  const normalized = email.toLowerCase();
  let endUser = await getEndUserByEmail(normalized);

  if (!endUser) {
    const { walletId, address } = await provisionInAppWallet(normalized);
    const id = nanoid();
    await execute(
      `INSERT INTO end_users (id, email, primary_address, backend_wallet_id, auth_method)
       VALUES ($1, $2, $3, $4, 'email')`,
      [id, normalized, address, walletId]
    );
    endUser = (await getEndUserById(id))!;
  }

  return issueSession(endUser);
}

export async function upsertSiweEndUser(address: string): Promise<SessionIssueResult> {
  let endUser = await getEndUserByAddress(address);

  if (!endUser) {
    const id = nanoid();
    await execute(
      `INSERT INTO end_users (id, email, primary_address, backend_wallet_id, auth_method)
       VALUES ($1, NULL, $2, NULL, 'siwe')`,
      [id, address]
    );
    endUser = (await getEndUserById(id))!;
  } else {
    await execute(`UPDATE end_users SET updated_at = NOW() WHERE id = $1`, [endUser.id]);
    endUser = (await getEndUserById(endUser.id))!;
  }

  return issueSession(endUser);
}

export async function resolveSessionEndUser(payload: SessionJwtPayload): Promise<EndUserRecord> {
  const endUser = await getEndUserById(payload.sub);
  if (!endUser) throw new Error("Session user not found.");
  if (endUser.primary_address.toLowerCase() !== payload.address.toLowerCase()) {
    throw new Error("Session address mismatch.");
  }
  return endUser;
}
