import type { ChainConfig } from "@apkaya/engine/platform";
import { indexEvmChain } from "./evmIndexer.js";
import { indexSolanaChain } from "./solanaIndexer.js";
import { getConnection, getProvider } from "@apkaya/engine/platform";

export function pollIntervalMs(): number {
  return Number(process.env.INSIGHT_POLL_INTERVAL_MS ?? 5000);
}

export async function indexChainConfig(chain: ChainConfig): Promise<void> {
  const chainRef = { chainFamily: chain.chainFamily, chainId: chain.chainId };
  if (chain.chainFamily === "solana") {
    await indexSolanaChain(chainRef, getConnection(chainRef));
  } else {
    await indexEvmChain(chainRef, getProvider(chainRef));
  }
}
