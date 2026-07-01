export type WalletAdapterType = "injected" | "walletconnect" | "in-app";

export interface SendTransactionRequest {
  to: string;
  value?: bigint;
  data?: string;
  chainId?: number;
}

export interface WalletAdapter {
  readonly id: string;
  readonly name: string;
  readonly type: WalletAdapterType;
  isAvailable(): boolean | Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string | null>;
  signMessage(message: string): Promise<string>;
  sendTransaction(tx: SendTransactionRequest): Promise<string>;
  subscribeAccountChange(callback: (address: string | null) => void): () => void;
}

export interface ConnectEngineConfig {
  baseUrl: string;
  apiKey: string;
}

export interface SecureStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface ConnectConfig {
  chainId: number;
  engine: ConnectEngineConfig;
  walletConnectProjectId?: string;
  /** Optional secure/async storage for in-app sessions (mobile keychain, etc.). */
  storage?: SecureStorage;
  siwe?: {
    domain: string;
    uri: string;
    statement?: string;
  };
}

export interface SessionInfo {
  sessionToken: string;
  expiresAt: string;
  address: string;
  authMethod: "email" | "siwe";
}

/** Stub for future Google/Apple/X OAuth providers — not implemented in v0. */
export interface SocialAuthProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  connect(): Promise<{ address: string; sessionToken?: string }>;
}

export class SocialAuthNotImplementedError extends Error {
  constructor(providerId: string) {
    super(`Social auth provider "${providerId}" is not implemented yet.`);
    this.name = "SocialAuthNotImplementedError";
  }
}

export const socialAuthProviders: SocialAuthProvider[] = [];
