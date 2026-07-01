import { Router } from "express";
import { z } from "zod";
import {
  getIndexerStatus,
  getNftsOwned,
  getTokenBalances,
  listEvents,
  listTransfers,
} from "../services/queries.js";

export const insightRouter = Router();

const chainIdQuery = z.object({
  chainId: z.coerce.number().int().positive(),
});

const transfersQuery = chainIdQuery.extend({
  contractAddress: z.string().optional(),
  fromBlock: z.coerce.number().int().nonnegative().optional(),
  toBlock: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const eventsQuery = chainIdQuery.extend({
  contractAddress: z.string().optional(),
  eventName: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const nftsQuery = chainIdQuery.extend({
  contractAddress: z.string().optional(),
});

insightRouter.get("/status", async (_req, res) => {
  const status = await getIndexerStatus();
  res.json({ result: status });
});

insightRouter.get("/tokens/:address/balances", async (req, res) => {
  const parsed = chainIdQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "chainId query parameter is required." });
    return;
  }

  const balances = await getTokenBalances(parsed.data.chainId, req.params.address);
  res.json({ result: balances });
});

insightRouter.get("/nfts/:address/owned", async (req, res) => {
  const parsed = nftsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "chainId query parameter is required." });
    return;
  }

  const owned = await getNftsOwned(
    parsed.data.chainId,
    req.params.address,
    parsed.data.contractAddress
  );
  res.json({ result: owned });
});

insightRouter.get("/transfers", async (req, res) => {
  const parsed = transfersQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid query." });
    return;
  }

  const transfers = await listTransfers(parsed.data);
  res.json({ result: transfers });
});

insightRouter.get("/events", async (req, res) => {
  const parsed = eventsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid query." });
    return;
  }

  const events = await listEvents(parsed.data);
  res.json({ result: events });
});
