export type { ConnectTheme } from "@apkaya/connect";
export { defaultDarkTheme, themeToCssVars } from "@apkaya/connect";

export interface BridgeEngineConfig {
  baseUrl: string;
  apiKey: string;
}

export interface OnrampSessionRequest {
  address: string;
  chainId: number;
  assets?: string[];
  clientIp: string;
  presetFiatAmount?: number;
}

export interface OnrampSessionResponse {
  token: string;
  popupUrl: string;
  expiresInSeconds: number;
}

export interface SwapQuoteRequest {
  chainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  taker: string;
  slippageBps?: number;
}

export interface SwapTransactionPayload {
  to: string;
  data: string;
  gas?: string;
  gasPrice?: string;
  value?: string;
}

export interface SwapQuoteResponse {
  network: string;
  liquidityAvailable: boolean;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount?: string;
  minToAmount?: string;
  transaction?: SwapTransactionPayload;
  permit2?: { hash: string; eip712: Record<string, unknown> } | null;
  issues?: Record<string, unknown>;
}

export interface BridgeSupportedResponse {
  cdpConfigured: boolean;
  swapNetworks: string[];
  onrampAssets: string[];
  onrampChains: Array<{ chainId: number; name: string }>;
  swapChains: Array<{ chainId: number; name: string }>;
  swapTokens: Record<string, Array<{ symbol: string; address: string; decimals: number; isNative?: boolean }>>;
}

export type OnrampEventName =
  | "onramp_api.cancel"
  | "onramp_api.commit_success"
  | "onramp_api.commit_error"
  | "onramp_api.polling_success"
  | "onramp_api.polling_failed";

export interface OnrampPostMessageEvent {
  eventName: OnrampEventName | string;
  data?: {
    errorCode?: string;
    errorMessage?: string;
  };
}

export type PaymentMethod = "card" | "crypto";

export type OnrampStatus = "idle" | "opening" | "processing" | "success" | "error" | "cancelled";

export type SwapStatus = "idle" | "quoting" | "ready" | "signing" | "pending" | "success" | "error";
