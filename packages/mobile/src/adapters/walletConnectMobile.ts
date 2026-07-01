import UniversalProvider from "@walletconnect/universal-provider";
import { BrowserProvider } from "ethers";
import type { ConnectConfig, SendTransactionRequest, WalletAdapter } from "@apkaya/connect";
import { Linking } from "react-native";

export interface WalletConnectMobileOptions {
  /** Deep link scheme for returning to the app, e.g. apkayaexample */
  appLinkScheme: string;
  onDisplayUri?: (uri: string) => void;
}

/**
 * WalletConnect v2 adapter for React Native using UniversalProvider.
 * Opens wc: URIs via the Linking API for external wallet apps.
 */
export class WalletConnectMobileAdapter implements WalletAdapter {
  readonly id = "walletconnect";
  readonly name = "WalletConnect";
  readonly type = "walletconnect" as const;

  private provider: UniversalProvider | null = null;
  private listeners = new Set<(address: string | null) => void>();

  constructor(
    private readonly config: ConnectConfig,
    private readonly mobileOptions: WalletConnectMobileOptions
  ) {}

  isAvailable(): boolean {
    return Boolean(this.config.walletConnectProjectId);
  }

  private getAccountAddresses(): string[] {
    if (!this.provider?.session) return [];
    const accounts =
      this.provider.session.namespaces.eip155?.accounts ??
      (this.provider as { accounts?: string[] }).accounts ??
      [];
    return accounts.map((a) => a.split(":")[2]).filter(Boolean) as string[];
  }

  async connect(): Promise<void> {
    if (!this.config.walletConnectProjectId) {
      throw new Error("walletConnectProjectId is required for WalletConnect.");
    }

    this.provider = await UniversalProvider.init({
      projectId: this.config.walletConnectProjectId,
      metadata: {
        name: "ApkayA Mobile",
        description: "ApkayA mobile wallet connect",
        url: `${this.mobileOptions.appLinkScheme}://`,
        icons: [],
      },
    });

    this.provider.on("display_uri", (uri: string) => {
      this.mobileOptions.onDisplayUri?.(uri);
      Linking.openURL(uri).catch(() => {
        /* wallet app may not be installed — caller can show QR/copy UI */
      });
    });

    await this.provider.connect({
      namespaces: {
        eip155: {
          methods: [
            "eth_sendTransaction",
            "eth_sign",
            "personal_sign",
            "eth_signTypedData",
            "eth_signTypedData_v4",
          ],
          chains: [`eip155:${this.config.chainId}`],
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });

    const addresses = this.getAccountAddresses();
    const address = addresses[0] ?? null;
    for (const cb of this.listeners) cb(address);
  }

  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
    }
    for (const cb of this.listeners) cb(null);
  }

  async getAddress(): Promise<string | null> {
    const addresses = this.getAccountAddresses();
    return addresses[0] ?? null;
  }

  private getEip1193Provider() {
    if (!this.provider) throw new Error("WalletConnect not connected.");
    return this.provider as unknown as import("ethers").Eip1193Provider;
  }

  async signMessage(message: string): Promise<string> {
    const ethersProvider = new BrowserProvider(this.getEip1193Provider(), this.config.chainId);
    const signer = await ethersProvider.getSigner();
    return signer.signMessage(message);
  }

  async sendTransaction(tx: SendTransactionRequest): Promise<string> {
    const ethersProvider = new BrowserProvider(this.getEip1193Provider(), this.config.chainId);
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
}

/** Handle WalletConnect deep-link return URLs (call from App Linking listener). */
export async function handleWalletConnectDeepLink(url: string): Promise<void> {
  // @walletconnect/react-native-compat registers global handlers when imported in app entry.
  await Linking.canOpenURL(url);
}
