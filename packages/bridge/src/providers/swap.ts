import type { BridgeEngineConfig, SwapQuoteRequest, SwapQuoteResponse } from "../core/types.js";
import { executeSwapQuote, fetchSwapQuote } from "../core/client.js";
import type { WalletAdapter } from "@apkaya/connect";
import { signAndSubmitSwap } from "../core/swapExecutor.js";

export interface SwapProvider {
  readonly id: string;
  getQuote(input: SwapQuoteRequest): Promise<SwapQuoteResponse>;
  execute(input: SwapQuoteRequest, adapter: WalletAdapter): Promise<string>;
}

export class CoinbaseSwapProvider implements SwapProvider {
  readonly id = "coinbase";

  constructor(private readonly engine: BridgeEngineConfig) {}

  async getQuote(input: SwapQuoteRequest): Promise<SwapQuoteResponse> {
    return fetchSwapQuote(this.engine, input);
  }

  async execute(input: SwapQuoteRequest, adapter: WalletAdapter): Promise<string> {
    const quote = await executeSwapQuote(this.engine, input);
    return signAndSubmitSwap(adapter, input.chainId, quote);
  }
}
