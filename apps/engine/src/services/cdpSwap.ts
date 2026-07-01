import { createCdpJwt } from "./cdpAuth.js";
import { chainIdToCdpNetwork, type CdpSwapNetwork } from "./cdpBridgeConfig.js";

const SWAP_HOST = "api.cdp.coinbase.com";
const SWAP_PATH = "/platform/v2/evm/swaps";

export interface SwapQuoteInput {
  chainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  taker: string;
  slippageBps?: number;
  gasPrice?: string;
  signerAddress?: string;
}

export interface SwapTransactionPayload {
  to: string;
  data: string;
  gas?: string;
  gasPrice?: string;
  value?: string;
}

export interface SwapQuoteResult {
  network: CdpSwapNetwork;
  liquidityAvailable: boolean;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount?: string;
  minToAmount?: string;
  transaction?: SwapTransactionPayload;
  permit2?: {
    hash: string;
    eip712: Record<string, unknown>;
  } | null;
  issues?: Record<string, unknown>;
}

export async function createSwapQuote(input: SwapQuoteInput): Promise<SwapQuoteResult> {
  const network = chainIdToCdpNetwork(input.chainId);
  if (!network) {
    throw new Error(
      `Chain ${input.chainId} is not supported by CDP Trade/Swap API. ` +
        "Supported mainnets: Ethereum, Base, Arbitrum, Optimism, Polygon."
    );
  }

  const body: Record<string, unknown> = {
    network,
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.fromAmount,
    taker: input.taker,
  };

  if (input.slippageBps !== undefined) body.slippageBps = input.slippageBps;
  if (input.gasPrice) body.gasPrice = input.gasPrice;
  if (input.signerAddress) body.signerAddress = input.signerAddress;

  const bodyStr = JSON.stringify(body);
  const jwt = await createCdpJwt({
    requestMethod: "POST",
    requestHost: SWAP_HOST,
    requestPath: SWAP_PATH,
  });

  const res = await fetch(`https://${SWAP_HOST}${SWAP_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: bodyStr,
  });

  const data = (await res.json().catch(() => ({}))) as SwapQuoteResult & {
    errorMessage?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(data.errorMessage ?? data.message ?? `CDP swap quote failed (${res.status})`);
  }

  return { ...data, network };
}

export async function executeSwapQuote(input: SwapQuoteInput): Promise<SwapQuoteResult> {
  return createSwapQuote(input);
}
