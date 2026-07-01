import { Router } from "express";
import { z } from "zod";
import { listChains } from "../services/chains.js";
import { isCdpConfigured } from "../services/cdpAuth.js";
import { createOnrampSession } from "../services/cdpOnramp.js";
import { createSwapQuote, executeSwapQuote } from "../services/cdpSwap.js";
import {
  CDP_SWAP_NETWORKS,
  ENGINE_CHAIN_TO_CDP_BLOCKCHAIN,
  isSwapSupportedChain,
  SWAP_TOKENS,
  ONRAMP_ASSETS,
} from "../services/cdpBridgeConfig.js";

export const bridgeRouter = Router();

const onrampSessionSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive(),
  assets: z.array(z.string()).optional(),
  clientIp: z.string().min(7),
  presetFiatAmount: z.number().positive().optional(),
});

const swapQuoteSchema = z.object({
  chainId: z.number().int().positive(),
  fromToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/i),
  toToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/i),
  fromAmount: z.string().regex(/^\d+$/),
  taker: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  slippageBps: z.number().int().min(0).max(10000).optional(),
});

bridgeRouter.get("/supported", (_req, res) => {
  const engineChains = listChains();
  const onrampChains = engineChains.filter((c) => ENGINE_CHAIN_TO_CDP_BLOCKCHAIN[c.chainId]);
  const swapChains = engineChains.filter((c) => isSwapSupportedChain(c.chainId));

  res.json({
    result: {
      cdpConfigured: isCdpConfigured(),
      swapNetworks: [...CDP_SWAP_NETWORKS],
      onrampAssets: [...ONRAMP_ASSETS],
      onrampChains,
      swapChains,
      swapTokens: SWAP_TOKENS,
    },
  });
});

bridgeRouter.post("/onramp/session", async (req, res, next) => {
  try {
    if (!isCdpConfigured()) {
      return res.status(503).json({
        error: "CDP is not configured. Set CDP_API_KEY_ID and CDP_API_KEY_SECRET on Engine.",
      });
    }

    const parsed = onrampSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    if (!listChains().some((c) => c.chainId === parsed.data.chainId)) {
      return res.status(400).json({ error: `Chain ${parsed.data.chainId} is not configured on Engine.` });
    }

    const blockchain = ENGINE_CHAIN_TO_CDP_BLOCKCHAIN[parsed.data.chainId];
    const result = await createOnrampSession({
      ...parsed.data,
      defaultNetwork: blockchain,
    });

    res.json({ result });
  } catch (err) {
    if (err instanceof Error && err.message.includes("CDP")) {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});

bridgeRouter.post("/swap/quote", async (req, res, next) => {
  try {
    if (!isCdpConfigured()) {
      return res.status(503).json({ error: "CDP is not configured on Engine." });
    }

    const parsed = swapQuoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const result = await createSwapQuote(parsed.data);
    res.status(201).json({ result });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

bridgeRouter.post("/swap/execute", async (req, res, next) => {
  try {
    if (!isCdpConfigured()) {
      return res.status(503).json({ error: "CDP is not configured on Engine." });
    }

    const parsed = swapQuoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const result = await executeSwapQuote(parsed.data);
    res.json({ result });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});
