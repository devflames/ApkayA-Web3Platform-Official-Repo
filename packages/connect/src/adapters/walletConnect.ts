import EthereumProvider from "@walletconnect/ethereum-provider";
import { BrowserProvider } from "ethers";
import type { ConnectConfig, SendTransactionRequest, WalletAdapter } from "../core/types.js";

export class WalletConnectAdapter implements WalletAdapter {
  readonly id = "walletconnect";
  readonly name = "WalletConnect";
  readonly type = "walletconnect" as const;

  private provider: EthereumProvider | null = null;
  private listeners = new Set<(address: string | null) => void>();

  constructor(private readonly config: ConnectConfig) {}

  isAvailable(): boolean {
    return Boolean(this.config.walletConnectProjectId);
  }

  async connect(): Promise<void> {
    if (!this.config.walletConnectProjectId) {
      throw new Error("walletConnectProjectId is required for WalletConnect.");
    }

    this.provider = await EthereumProvider.init({
      projectId: this.config.walletConnectProjectId,
      chains: [this.config.chainId],
      showQrModal: true,
      metadata: {
        name: "ApkayA Connect",
        description: "Connect your wallet",
        url: typeof window !== "undefined" ? window.location.origin : "https://apkaya.dev",
        icons: [],
      },
    });

    await this.provider.enable();

    this.provider.on("accountsChanged", (accounts: string[]) => {
      const address = accounts[0] ?? null;
      for (const cb of this.listeners) cb(address);
    });

    this.provider.on("disconnect", () => {
      for (const cb of this.listeners) cb(null);
    });
  }

  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
    }
  }

  async getAddress(): Promise<string | null> {
    if (!this.provider) return null;
    const accounts = this.provider.accounts;
    return accounts[0] ?? null;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.provider) throw new Error("WalletConnect not connected.");
    const ethersProvider = new BrowserProvider(this.provider, this.config.chainId);
    const signer = await ethersProvider.getSigner();
    return signer.signMessage(message);
  }

  async sendTransaction(tx: SendTransactionRequest): Promise<string> {
    if (!this.provider) throw new Error("WalletConnect not connected.");
    const ethersProvider = new BrowserProvider(this.provider, this.config.chainId);
    const signer = await ethersProvider.getSigner();
    const response = await signer.sendTransaction({
      to: tx.to,
      value: tx.value ?? 0n,
      data: tx.data,
      chainId: tx.chainId ?? this.config.chainId,
    });
    return response.hash;
  }

  subscribeAccountChange(callback: (address: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getEthersProvider(): BrowserProvider | null {
    if (!this.provider) return null;
    return new BrowserProvider(this.provider, this.config.chainId);
  }
}
