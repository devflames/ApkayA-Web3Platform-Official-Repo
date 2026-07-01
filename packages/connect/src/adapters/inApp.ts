import {
  inAppSendTransaction,
  inAppSignMessage,
  verifyEmailCode,
  type SiweSessionResult,
} from "../core/siwe.js";
import type { ConnectConfig, SendTransactionRequest, WalletAdapter } from "../core/types.js";

const SESSION_STORAGE_KEY = "apkaya_connect_in_app_session";

export class InAppWalletAdapter implements WalletAdapter {
  readonly id = "in-app";
  readonly name = "Email Wallet";
  readonly type = "in-app" as const;

  private session: SiweSessionResult | null = null;
  private listeners = new Set<(address: string | null) => void>();

  constructor(private readonly config: ConnectConfig) {
    this.restoreSession();
  }

  private restoreSession(): void {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    try {
      this.session = JSON.parse(raw) as SiweSessionResult;
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private persistSession(session: SiweSessionResult | null): void {
    if (typeof window === "undefined") return;
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  isAvailable(): boolean {
    return Boolean(this.config.engine?.baseUrl && this.config.engine?.apiKey);
  }

  /** Called by Connect UI after email OTP verification — not a direct user action. */
  async establishSession(session: SiweSessionResult): Promise<void> {
    this.session = session;
    this.persistSession(session);
    for (const cb of this.listeners) cb(session.address);
  }

  async connect(): Promise<void> {
    if (this.session) return;
    throw new Error("In-app wallet requires email verification via Connect UI.");
  }

  async disconnect(): Promise<void> {
    this.session = null;
    this.persistSession(null);
    for (const cb of this.listeners) cb(null);
  }

  async getAddress(): Promise<string | null> {
    return this.session?.address ?? null;
  }

  getSessionToken(): string | null {
    return this.session?.sessionToken ?? null;
  }

  async signMessage(message: string): Promise<string> {
    const token = this.getSessionToken();
    if (!token) throw new Error("In-app wallet not connected.");
    return inAppSignMessage(this.config.engine, token, message);
  }

  async sendTransaction(tx: SendTransactionRequest): Promise<string> {
    const token = this.getSessionToken();
    if (!token) throw new Error("In-app wallet not connected.");

    const result = await inAppSendTransaction(this.config.engine, token, {
      chainId: tx.chainId ?? this.config.chainId,
      toAddress: tx.to,
      data: tx.data,
      valueWei: (tx.value ?? 0n).toString(),
    });

    return result.tx_hash ?? result.id;
  }

  subscribeAccountChange(callback: (address: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export async function completeEmailLogin(
  config: ConnectConfig,
  email: string,
  code: string
): Promise<SiweSessionResult> {
  return verifyEmailCode(config.engine, { email, code });
}
