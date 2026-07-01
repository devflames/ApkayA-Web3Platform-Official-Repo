import { Router } from "express";
import { z } from "zod";
import { createBackendWallet, listBackendWallets, getBackendWallet } from "../services/wallets.js";
import { getProvider } from "../services/chains.js";

export const walletRouter = Router();

const createWalletSchema = z.object({
  label: z.string().min(1).max(100),
});

walletRouter.post("/create", async (req, res, next) => {
  try {
    const parsed = createWalletSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const wallet = await createBackendWallet(parsed.data.label);
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

    const chainId = Number(req.query.chainId);
    if (!chainId) return res.status(400).json({ error: "chainId query param is required" });

    const provider = getProvider(chainId);
    const balance = await provider.getBalance(wallet.address);
    res.json({ result: { address: wallet.address, chainId, balanceWei: balance.toString() } });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unsupported chain")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});
