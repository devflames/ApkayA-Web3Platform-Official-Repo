import type { WalletAdapter } from "@apkaya/connect";
import { InjectedAdapter } from "@apkaya/connect";
import { BrowserProvider } from "ethers";
import type { SwapQuoteResponse } from "./types.js";

function getSignerProvider(adapter: WalletAdapter, chainId: number): BrowserProvider {
  if (adapter instanceof InjectedAdapter) {
    const provider = adapter.getEthersProvider();
    if (!provider) throw new Error("Wallet provider not available.");
    return provider;
  }

  const wc = adapter as WalletAdapter & { getEthersProvider?: () => BrowserProvider | null };
  if (typeof wc.getEthersProvider === "function") {
    const provider = wc.getEthersProvider();
    if (provider) return provider;
  }

  throw new Error("Crypto swaps require an injected or WalletConnect wallet.");
}

export async function signAndSubmitSwap(
  adapter: WalletAdapter,
  chainId: number,
  quote: SwapQuoteResponse
): Promise<string> {
  if (!quote.liquidityAvailable || !quote.transaction) {
    throw new Error("Swap quote has no available liquidity or transaction payload.");
  }

  const provider = getSignerProvider(adapter, chainId);
  const signer = await provider.getSigner();

  if (quote.permit2?.eip712) {
    const eip712 = quote.permit2.eip712 as {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    };

    const types = { ...eip712.types };
    delete (types as Record<string, unknown>).EIP712Domain;

    await signer.signTypedData(eip712.domain, types, eip712.message);
  }

  const tx = quote.transaction;
  const response = await signer.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: BigInt(tx.value ?? "0"),
    gasLimit: tx.gas ? BigInt(tx.gas) : undefined,
    gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
  });

  return response.hash;
}
