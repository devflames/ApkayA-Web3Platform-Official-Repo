import { Router } from "express";
import { z } from "zod";
import {
  enqueueTransaction,
  getTransaction,
  listTransactions,
  cancelTransaction,
} from "../services/transactions.js";
import { getBackendWallet } from "../services/wallets.js";
import { findChain } from "../services/chains.js";
import {
  resolveChainRef,
  validateAddressForFamily,
  parseChainFamily,
  normalizeChainIdInput,
} from "../services/chainRef.js";

export const transactionRouter = Router();

const chainIdInput = z.union([z.string().min(1), z.number().int().positive()]);

const sendSchema = z
  .object({
    chainFamily: z.enum(["evm", "solana"]).optional(),
    chainId: chainIdInput,
    fromWalletId: z.string().min(1),
    toAddress: z.string().min(1),
    data: z.string().optional(),
    valueWei: z.string().regex(/^\d+$/).optional(),
    idempotencyKey: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((body, ctx) => {
    const ref = resolveChainRef(body);
    if (!validateAddressForFamily(body.toAddress, ref.chainFamily)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `toAddress is not a valid ${ref.chainFamily} address`,
        path: ["toAddress"],
      });
    }
    if (ref.chainFamily === "evm" && body.data && !/^0x[a-fA-F0-9]*$/.test(body.data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data must be hex for EVM", path: ["data"] });
    }
  });

transactionRouter.post("/send", async (req, res, next) => {
  try {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const chainRef = resolveChainRef(parsed.data);
    const chain = findChain(chainRef);
    if (!chain) {
      return res.status(400).json({
        error: `Chain ${chainRef.chainFamily}:${chainRef.chainId} is not configured on this Engine instance`,
      });
    }

    const wallet = await getBackendWallet(parsed.data.fromWalletId);
    if (!wallet) {
      return res.status(404).json({ error: `Backend wallet ${parsed.data.fromWalletId} not found` });
    }
    if (wallet.chain_family !== chainRef.chainFamily) {
      return res.status(400).json({
        error: `Wallet chain family (${wallet.chain_family}) does not match transaction chain (${chainRef.chainFamily})`,
      });
    }

    const tx = await enqueueTransaction(parsed.data);
    res.status(202).json({ result: tx });
  } catch (err) {
    next(err);
  }
});

transactionRouter.get("/status/:id", async (req, res, next) => {
  try {
    const tx = await getTransaction(req.params.id);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    res.json({ result: tx });
  } catch (err) {
    next(err);
  }
});

transactionRouter.get("/", async (req, res, next) => {
  try {
    const { status, walletId, chainId, chainFamily, limit } = req.query;
    const family = typeof chainFamily === "string" ? parseChainFamily(chainFamily) : undefined;
    const result = await listTransactions({
      status: typeof status === "string" ? status : undefined,
      walletId: typeof walletId === "string" ? walletId : undefined,
      chainFamily: family ?? undefined,
      chainId: chainId ? normalizeChainIdInput(chainId as string) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

transactionRouter.post("/cancel/:id", async (req, res, next) => {
  try {
    const cancelled = await cancelTransaction(req.params.id);
    if (!cancelled) {
      return res
        .status(409)
        .json({ error: "Transaction could not be cancelled (already sent, or does not exist)" });
    }
    res.json({ result: { id: req.params.id, status: "cancelled" } });
  } catch (err) {
    next(err);
  }
});
