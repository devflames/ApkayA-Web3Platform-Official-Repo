import { Router } from "express";
import { z } from "zod";
import {
  getIndexerStatus,
  getNftsOwned,
  getTokenBalances,
  listEvents,
  listTransfers,
  type ChainQuery,
} from "../services/queries.js";

export const insightRouter = Router();

const chainQuerySchema = z.object({
  chainFamily: z.enum(["evm", "solana"]).optional().default("evm"),
  chainId: z.union([z.string().min(1), z.coerce.number().int().positive()]),
});

function parseChainQuery(query: unknown): ChainQuery | null {
  const parsed = chainQuerySchema.safeParse(query);
  if (!parsed.success) return null;
  return {
    chainFamily: parsed.data.chainFamily,
    chainId: String(parsed.data.chainId),
  };
}

const transfersQuery = chainQuerySchema.extend({
  contractAddress: z.string().optional(),
  fromBlock: z.coerce.number().int().nonnegative().optional(),
  toBlock: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const eventsQuery = chainQuerySchema.extend({
  contractAddress: z.string().optional(),
  eventName: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const nftsQuery = chainQuerySchema.extend({
  contractAddress: z.string().optional(),
});

insightRouter.get("/status", async (_req, res) => {
  const status = await getIndexerStatus();
  res.json({ result: status });
});

insightRouter.get("/tokens/:address/balances", async (req, res) => {
  const chain = parseChainQuery(req.query);
  if (!chain) {
    res.status(400).json({ error: "chainId query parameter is required." });
    return;
  }

  const balances = await getTokenBalances(chain, req.params.address);
  res.json({ result: balances });
});

insightRouter.get("/nfts/:address/owned", async (req, res) => {
  const parsed = nftsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "chainId query parameter is required." });
    return;
  }

  if (parsed.data.chainFamily === "solana") {
    res.status(400).json({ error: "NFT ownership queries are EVM-only in this release." });
    return;
  }

  const chain: ChainQuery = {
    chainFamily: parsed.data.chainFamily,
    chainId: String(parsed.data.chainId),
  };

  const owned = await getNftsOwned(chain, req.params.address, parsed.data.contractAddress);
  res.json({ result: owned });
});

insightRouter.get("/transfers", async (req, res) => {
  const parsed = transfersQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid query." });
    return;
  }

  const chain: ChainQuery = {
    chainFamily: parsed.data.chainFamily,
    chainId: String(parsed.data.chainId),
  };

  const transfers = await listTransfers(chain, parsed.data);
  res.json({ result: transfers });
});

insightRouter.get("/events", async (req, res) => {
  const parsed = eventsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid query." });
    return;
  }

  const chain: ChainQuery = {
    chainFamily: parsed.data.chainFamily,
    chainId: String(parsed.data.chainId),
  };

  const events = await listEvents(chain, parsed.data);
  res.json({ result: events });
});
