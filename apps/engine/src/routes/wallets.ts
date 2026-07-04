import { Router } from "express";
import { z } from "zod";
import {
  createBackendWallet,
  listBackendWallets,
  getBackendWallet,
} from "../services/wallets.js";
import { findChain } from "../services/chains.js";
import { getAdapterForRef } from "../adapters/registry.js";
import {
  balanceUnit,
  parseChainFamily,
  resolveChainRef,
  normalizeChainIdInput,
} from "../services/chainRef.js";

export const walletRouter = Router();

const createWalletSchema = z.object({
  label: z.string().min(1).max(100),
  chainFamily: z.enum(["evm", "solana"]).optional(),
});

walletRouter.post("/create", async (req, res, next) => {
  try {
    const parsed = createWalletSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const wallet = await createBackendWallet(parsed.data.label, parsed.data.chainFamily ?? "evm");
    res.status(201).json({ result: wallet });
  } catch (err) {
    next(err);
  }
});

walletRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ result: await listBackendWallets() });
  } catch (err) {
    next(err);
  }
});

walletRouter.get("/:id", async (req, res, next) => {
  try {
    const wallet = await getBackendWallet(req.params.id);
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });
    res.json({ result: wallet });
  } catch (err) {
    next(err);
  }
});

walletRouter.get("/:id/balance", async (req, res, next) => {
  try {
    const wallet = await getBackendWallet(req.params.id);
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    const chainFamilyRaw = req.query.chainFamily;
    const chainIdRaw = req.query.chainId;
    if (!chainIdRaw) {
      return res.status(400).json({ error: "chainId query param is required" });
    }

    const chainRef = resolveChainRef({
      chainFamily: typeof chainFamilyRaw === "string" ? parseChainFamily(chainFamilyRaw) ?? undefined : wallet.chain_family,
      chainId: normalizeChainIdInput(chainIdRaw as string),
    });

    if (wallet.chain_family !== chainRef.chainFamily) {
      return res.status(400).json({ error: "Wallet chain family does not match requested chain" });
    }

    if (!findChain(chainRef)) {
      return res.status(400).json({ error: `Chain ${chainRef.chainFamily}:${chainRef.chainId} is not configured` });
    }

    const adapter = getAdapterForRef(chainRef);
    const balance = await adapter.getBalance(wallet.address, chainRef);

    res.json({
      result: {
        address: wallet.address,
        chainFamily: chainRef.chainFamily,
        chainId: chainRef.chainId,
        balance,
        unit: balanceUnit(chainRef.chainFamily),
        balanceWei: chainRef.chainFamily === "evm" ? balance : undefined,
        balanceLamports: chainRef.chainFamily === "solana" ? balance : undefined,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unsupported chain")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});
