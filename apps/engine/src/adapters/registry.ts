import type { ChainFamily, ChainRef } from "../services/chainRef.js";
import type { ChainConfig } from "../services/chains.js";
import { evmAdapter } from "./evmAdapter.js";
import { solanaAdapter } from "./solanaAdapter.js";
import type { ChainAdapter } from "./types.js";

export function getAdapter(family: ChainFamily): ChainAdapter {
  return family === "solana" ? solanaAdapter : evmAdapter;
}

export function getAdapterForChain(config: ChainConfig): ChainAdapter {
  return getAdapter(config.chainFamily);
}

export function getAdapterForRef(ref: ChainRef): ChainAdapter {
  return getAdapter(ref.chainFamily);
}

export { evmAdapter, solanaAdapter };
export type { ChainAdapter } from "./types.js";
