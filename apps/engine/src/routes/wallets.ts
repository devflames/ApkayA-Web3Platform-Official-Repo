import { Router } from "express";
import { z } from "zod";
import { createBackendWallet, listBackendWallets, getBackendWallet } from "../services/wallets.js";
import { getProvider } from "../services/chains.js";

export const walletRouter = Router();

const createWalletSchema = z.object({
  label: z.string().min(1).max(100),
});

// POST /backend-wallet/create
walletRouter.post("/create", (req, res) => {
  const parsed = createWalletSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const wallet = createBackendWallet(parsed.data.label);
  res.status(201).json({ result: wallet });
});

// GET /backend-wallet
walletRouter.get("/", (_req, res) => {
  res.json({ result: listBackendWallets() });
});

// GET /backend-wallet/:id
walletRouter.get("/:id", (req, res) => {
  const wallet = getBackendWallet(req.params.id);
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  res.json({ result: wallet });
});

// GET /backend-wallet/:id/balance?chainId=80002
walletRouter.get("/:id/balance", async (req, res) => {
  const wallet = getBackendWallet(req.params.id);
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  const chainId = Number(req.query.chainId);
  if (!chainId) return res.status(400).json({ error: "chainId query param is required" });

  try {
    const provider = getProvider(chainId);
    const balance = await provider.getBalance(wallet.address);
    res.json({ result: { address: wallet.address, chainId, balanceWei: balance.toString() } });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to fetch balance" });
  }
});
