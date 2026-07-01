import type {
  BridgeEngineConfig,
  BridgeSupportedResponse,
  OnrampSessionRequest,
  OnrampSessionResponse,
  SwapQuoteRequest,
  SwapQuoteResponse,
} from "./types.js";

async function bridgeFetch<T>(
  engine: BridgeEngineConfig,
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
  if (!res.ok) throw new Error(body.error ?? `Bridge request failed (${res.status})`);
  return body.result as T;
}

export async function fetchBridgeSupported(engine: BridgeEngineConfig): Promise<BridgeSupportedResponse> {
  return bridgeFetch(engine, "/bridge/supported");
}

export async function createOnrampSession(
  engine: BridgeEngineConfig,
  input: OnrampSessionRequest
): Promise<OnrampSessionResponse> {
  return bridgeFetch(engine, "/bridge/onramp/session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchSwapQuote(
  engine: BridgeEngineConfig,
  input: SwapQuoteRequest
): Promise<SwapQuoteResponse> {
  return bridgeFetch(engine, "/bridge/swap/quote", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function executeSwapQuote(
  engine: BridgeEngineConfig,
  input: SwapQuoteRequest
): Promise<SwapQuoteResponse> {
  return bridgeFetch(engine, "/bridge/swap/execute", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Best-effort public IP for CDP onramp session tokens (required by CDP API). */
export async function detectClientIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = (await res.json()) as { ip?: string };
    if (data.ip) return data.ip;
  } catch {
    // fall through
  }
  return "127.0.0.1";
}
