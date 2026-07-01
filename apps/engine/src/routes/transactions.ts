import { Router } from "express";
import { z } from "zod";
import {
  enqueueTransaction,
  getTransaction,
  listTransactions,
  cancelTransaction,
} from "../services/transactions.js";
import { getBackendWallet } from "../services/wallets.js";
import { listChains } from "../services/chains.js";

export const transactionRouter = Router();

const sendSchema = z.object({
  chainId: z.number().int().positive(),
  fromWalletId: z.string().min(1),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "toAddress must be a valid EVM address"),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/).optional(),
  valueWei: z.string().regex(/^\d+$/).optional(),
  idempotencyKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// POST /transaction/send
transactionRouter.post("/send", (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const { chainId, fromWalletId } = parsed.data;

  if (!getBackendWallet(fromWalletId)) {
    return res.status(404).json({ error: `Backend wallet ${fromWalletId} not found` });
  }
  if (!listChains().some((c) => c.chainId === chainId)) {
    return res.status(400).json({ error: `Chain ${chainId} is not configured on this Engine instance` });
  }

  const tx = enqueueTransaction(parsed.data);
  // Queued id is returned immediately — the caller polls /transaction/status/:id
  // or listens for the tx.mined webhook rather than blocking on confirmation.
  res.status(202).json({ result: tx });
});

// GET /transaction/status/:id
transactionRouter.get("/status/:id", (req, res) => {
  const tx = getTransaction(req.params.id);
  if (!tx) return res.status(404).json({ error: "Transaction not found" });
  res.json({ result: tx });
});

// GET /transaction?status=queued&walletId=...&chainId=80002&limit=50
transactionRouter.get("/", (req, res) => {
  const { status, walletId, chainId, limit } = req.query;
  const result = listTransactions({
    status: typeof status === "string" ? status : undefined,
    walletId: typeof walletId === "string" ? walletId : undefined,
    chainId: chainId ? Number(chainId) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ result });
});

// POST /transaction/cancel/:id
transactionRouter.post("/cancel/:id", (req, res) => {
  const cancelled = cancelTransaction(req.params.id);
  if (!cancelled) {
    return res
      .status(409)
      .json({ error: "Transaction could not be cancelled (already sent, or does not exist)" });
  }
  res.json({ result: { id: req.params.id, status: "cancelled" } });
});
