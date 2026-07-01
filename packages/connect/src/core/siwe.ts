import type { ConnectEngineConfig } from "./types.js";

export interface SiweNonceResult {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface SiweSessionResult {
  sessionToken: string;
  expiresAt: string;
  address: string;
  authMethod: string;
  endUserId: string;
  backendWalletId: string | null;
}

async function engineFetch<T>(
  engine: ConnectEngineConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${engine.baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${engine.apiKey}`,
      ...(init?.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Engine request failed (${res.status})`);
  return body.result as T;
}

export async function requestSiweNonce(
  engine: ConnectEngineConfig,
  input: { address: string; chainId: number; domain: string; uri: string; statement?: string }
): Promise<SiweNonceResult> {
  return engineFetch(engine, "/auth/siwe/nonce", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifySiwe(
  engine: ConnectEngineConfig,
  input: { message: string; signature: string }
): Promise<SiweSessionResult> {
  return engineFetch(engine, "/auth/siwe/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestEmailCode(
  engine: ConnectEngineConfig,
  email: string
): Promise<{ expiresAt: string; devCode?: string }> {
  return engineFetch(engine, "/auth/email/request-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmailCode(
  engine: ConnectEngineConfig,
  input: { email: string; code: string }
): Promise<SiweSessionResult> {
  return engineFetch(engine, "/auth/email/verify-code", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function inAppSignMessage(
  engine: ConnectEngineConfig,
  sessionToken: string,
  message: string
): Promise<string> {
  const result = await engineFetch<{ signature: string }>(engine, "/auth/in-app/sign-message", {
    method: "POST",
    headers: { "X-Apkaya-Session": sessionToken },
    body: JSON.stringify({ message }),
  });
  return result.signature;
}

export async function inAppSendTransaction(
  engine: ConnectEngineConfig,
  sessionToken: string,
  input: {
    chainId: number;
    toAddress: string;
    data?: string;
    valueWei?: string;
    idempotencyKey?: string;
  }
): Promise<{ id: string; status: string; tx_hash?: string | null }> {
  return engineFetch(engine, "/auth/in-app/send-transaction", {
    method: "POST",
    headers: { "X-Apkaya-Session": sessionToken },
    body: JSON.stringify(input),
  });
}
