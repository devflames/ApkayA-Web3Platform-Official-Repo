/**
 * CDP network / blockchain coverage as documented for Trade API (beta, July 2025).
 * Verify against https://docs.cdp.coinbase.com/trade-api/welcome before adding chains.
 */
export const CDP_SWAP_NETWORKS = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
] as const;

export type CdpSwapNetwork = (typeof CDP_SWAP_NETWORKS)[number];

/** Maps Engine chain_id to CDP swap network slug. */
export const ENGINE_CHAIN_TO_CDP_NETWORK: Record<number, CdpSwapNetwork> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
};

/** Maps Engine chain_id to CDP onramp blockchain slug (session token API naming). */
export const ENGINE_CHAIN_TO_CDP_BLOCKCHAIN: Record<number, string> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
  11155111: "ethereum",
  80002: "polygon",
};

export function chainIdToCdpNetwork(chainId: number): CdpSwapNetwork | undefined {
  return ENGINE_CHAIN_TO_CDP_NETWORK[chainId];
}

export function chainIdToCdpBlockchain(chainId: number): string | undefined {
  return ENGINE_CHAIN_TO_CDP_BLOCKCHAIN[chainId];
}

export function isSwapSupportedChain(chainId: number): boolean {
  return chainId in ENGINE_CHAIN_TO_CDP_NETWORK;
}

/** Popular ERC-20 addresses per CDP swap network (mainnet). */
export const SWAP_TOKENS: Record<
  CdpSwapNetwork,
  Array<{ symbol: string; address: string; decimals: number; isNative?: boolean }>
> = {
  ethereum: [
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, isNative: true },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
  ],
  base: [
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, isNative: true },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  ],
  arbitrum: [
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, isNative: true },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  ],
  optimism: [
    { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, isNative: true },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
  ],
  polygon: [
    { symbol: "MATIC", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, isNative: true },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  ],
};

export const ONRAMP_ASSETS = ["ETH", "USDC", "MATIC", "BTC"] as const;

export const ONRAMP_POPUP_BASE = "https://pay.coinbase.com/buy/select-asset";
