import crypto from "node:crypto";
import { verifyMessage } from "ethers";
import { execute, queryOne } from "../db/index.js";

const NONCE_TTL_MS = 5 * 60 * 1000;

export interface SiweMessageFields {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildSiweMessage(fields: SiweMessageFields): string {
  const lines = [
    `${fields.domain} wants you to sign in with your Ethereum account:`,
    fields.address,
    "",
    fields.statement,
    "",
    `URI: ${fields.uri}`,
    `Version: ${fields.version}`,
    `Chain ID: ${fields.chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
  ];
  if (fields.expirationTime) {
    lines.push(`Expiration Time: ${fields.expirationTime}`);
  }
  return lines.join("\n");
}

export async function createSiweNonce(input: {
  address: string;
  chainId: number;
  domain: string;
  uri: string;
  statement?: string;
}): Promise<{ nonce: string; message: string; expiresAt: string }> {
  const nonce = generateNonce();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

  await execute(
    `INSERT INTO siwe_nonces (nonce, address, chain_id, chain_family, expires_at)
     VALUES ($1, $2, $3, 'evm', $4)`,
    [nonce, input.address.toLowerCase(), String(input.chainId), expiresAt]
  );

  const message = buildSiweMessage({
    domain: input.domain,
    address: input.address,
    statement: input.statement ?? "Sign in with Ethereum to ApkayA.",
    uri: input.uri,
    version: "1",
    chainId: input.chainId,
    nonce,
    issuedAt,
    expirationTime: expiresAt,
  });

  return { nonce, message, expiresAt };
}

function parseSiweMessage(message: string): Record<string, string> {
  const lines = message.split("\n");
  const address = lines[1]?.trim() ?? "";
  const fields: Record<string, string> = { address };

  for (const line of lines) {
    const match = line.match(/^([^:]+): (.+)$/);
    if (match) fields[match[1].trim()] = match[2].trim();
  }

  const nonceLine = lines.find((l) => l.startsWith("Nonce: "));
  if (nonceLine) fields.Nonce = nonceLine.slice("Nonce: ".length);

  return fields;
}

export async function verifySiweSignature(input: {
  message: string;
  signature: string;
}): Promise<{ address: string; chainId: number; nonce: string }> {
  const fields = parseSiweMessage(input.message);
  const address = fields.address;
  const nonce = fields.Nonce;
  const chainId = Number(fields["Chain ID"]);

  if (!address || !nonce || !Number.isFinite(chainId)) {
    throw new Error("Malformed SIWE message.");
  }

  const recovered = verifyMessage(input.message, input.signature);
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    throw new Error("SIWE signature does not match message address.");
  }

  const row = await queryOne<{ expires_at: Date; used_at: Date | null; address: string }>(
    `SELECT expires_at, used_at, address FROM siwe_nonces WHERE nonce = $1`,
    [nonce]
  );

  if (!row) throw new Error("SIWE nonce not found.");
  if (row.used_at) throw new Error("SIWE nonce already used.");
  if (row.expires_at.getTime() < Date.now()) throw new Error("SIWE nonce expired.");
  if (row.address.toLowerCase() !== address.toLowerCase()) {
    throw new Error("SIWE nonce address mismatch.");
  }

  await execute(`UPDATE siwe_nonces SET used_at = NOW() WHERE nonce = $1`, [nonce]);

  return { address: recovered, chainId, nonce };
}
