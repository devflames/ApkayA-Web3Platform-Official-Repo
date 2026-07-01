import { BrowserProvider, hexlify, toUtf8Bytes } from "ethers";
import type { ConnectConfig, SendTransactionRequest, WalletAdapter } from "../core/types.js";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  return eth ?? null;
}

export class InjectedAdapter implements WalletAdapter {
  readonly id = "injected";
  readonly name = "Browser Wallet";
  readonly type = "injected" as const;

  private provider: BrowserProvider | null = null;
  private listeners = new Set<(address: string | null) => void>();
  private accountHandler: ((accounts: unknown) => void) | null = null;

  constructor(private readonly chainId: number) {}

  isAvailable(): boolean {
    return getInjectedProvider() !== null;
  }

  private rawProvider(): Eip1193Provider {
    const p = getInjectedProvider();
    if (!p) throw new Error("No injected wallet found.");
    return p;
  }

  async connect(): Promise<void> {
    const raw = this.rawProvider();
    await raw.request({ method: "eth_requestAccounts" });
    this.provider = new BrowserProvider(raw, this.chainId);
    this.bindAccountEvents(raw);
  }

  private bindAccountEvents(raw: Eip1193Provider): void {
    if (!raw.on || this.accountHandler) return;
    this.accountHandler = (accounts: unknown) => {
      const list = accounts as string[];
      const address = list?.[0] ?? null;
      for (const cb of this.listeners) cb(address);
    };
    raw.on("accountsChanged", this.accountHandler);
  }

  async disconnect(): Promise<void> {
    const raw = getInjectedProvider();
    if (raw?.removeListener && this.accountHandler) {
      raw.removeListener("accountsChanged", this.accountHandler);
    }
    this.accountHandler = null;
    this.provider = null;
  }

  async getAddress(): Promise<string | null> {
    if (!this.provider) {
      const raw = getInjectedProvider();
      if (!raw) return null;
      this.provider = new BrowserProvider(raw, this.chainId);
    }
    const accounts = (await this.provider.send("eth_accounts", [])) as string[];
    return accounts[0] ?? null;
  }

  async signMessage(message: string): Promise<string> {
    const provider = this.provider ?? new BrowserProvider(this.rawProvider(), this.chainId);
    const signer = await provider.getSigner();
    return signer.signMessage(message);
  }

  async sendTransaction(tx: SendTransactionRequest): Promise<string> {
    const provider = this.provider ?? new BrowserProvider(this.rawProvider(), this.chainId);
    const signer = await provider.getSigner();
    const response = await signer.sendTransaction({
      to: tx.to,
      value: tx.value ?? 0n,
      data: tx.data,
      chainId: tx.chainId ?? this.chainId,
    });
    return response.hash;
  }

  subscribeAccountChange(callback: (address: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getEthersProvider(): BrowserProvider | null {
    if (!this.provider) {
      const raw = getInjectedProvider();
      if (!raw) return null;
      return new BrowserProvider(raw, this.chainId);
    }
    return this.provider;
  }
}

export function detectInjectedWalletName(): string {
  if (typeof window === "undefined") return "Browser Wallet";
  const eth = (window as Window & { ethereum?: { isMetaMask?: boolean; isRabby?: boolean } }).ethereum;
  if (!eth) return "Browser Wallet";
  if (eth.isRabby) return "Rabby";
  if (eth.isMetaMask) return "MetaMask";
  return "Browser Wallet";
}

/** Utility for providers that expect hex-encoded personal_sign payloads. */
export function messageToHex(message: string): string {
  return hexlify(toUtf8Bytes(message));
}
