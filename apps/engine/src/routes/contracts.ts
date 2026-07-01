import { Router } from "express";
import { z } from "zod";
import {
  registerContract,
  listContracts,
  getContract,
  readContractFunction,
  writeContractFunction,
  listContractFunctions,
} from "../services/contracts.js";
import { getBackendWallet } from "../services/wallets.js";
import { listChains } from "../services/chains.js";
import { getTransaction } from "../services/transactions.js";

export const contractRouter = Router();

const registerSchema = z.object({
  chainId: z.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(200),
  abi: z.array(z.unknown()),
  deployerWalletId: z.string().optional(),
  txId: z.string().optional(),
});

const readSchema = z.object({
  functionName: z.string().min(1),
  args: z.array(z.unknown()).optional(),
});

const writeSchema = z.object({
  fromWalletId: z.string().min(1),
  functionName: z.string().min(1),
  args: z.array(z.unknown()).optional(),
  valueWei: z.string().regex(/^\d+$/).optional(),
  idempotencyKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

contractRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const { chainId, deployerWalletId, txId } = parsed.data;

    if (!listChains().some((c) => c.chainId === chainId)) {
      return res.status(400).json({ error: `Chain ${chainId} is not configured on this Engine instance` });
    }
    if (deployerWalletId && !(await getBackendWallet(deployerWalletId))) {
      return res.status(404).json({ error: `Backend wallet ${deployerWalletId} not found` });
    }
    if (txId && !(await getTransaction(txId))) {
      return res.status(404).json({ error: `Transaction ${txId} not found` });
    }

    const contract = await registerContract(parsed.data);
    res.status(201).json({ result: contract });
  } catch (err) {
    const pgCode = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (pgCode === "23505") {
      return res.status(409).json({ error: "Contract already registered on this chain at this address." });
    }
    next(err);
  }
});

contractRouter.get("/", async (req, res, next) => {
  try {
    const chainId = req.query.chainId ? Number(req.query.chainId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await listContracts({ chainId, limit });
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

contractRouter.get("/:id", async (req, res, next) => {
  try {
    const contract = await getContract(req.params.id);
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    const functions = listContractFunctions(contract.abi_json);
    res.json({
      result: {
        ...contract,
        abi: JSON.parse(contract.abi_json),
        functions,
      },
    });
  } catch (err) {
    next(err);
  }
});

contractRouter.post("/:id/read", async (req, res, next) => {
  try {
    const parsed = readSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const { result } = await readContractFunction(
      req.params.id,
      parsed.data.functionName,
      parsed.data.args ?? []
    );
    res.json({ result: { value: result } });
  } catch (err) {
    if (err instanceof Error && err.message === "Contract not found") {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof Error && (err.message.includes("read-only") || err.message.includes("not found in contract"))) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

contractRouter.post("/:id/write", async (req, res, next) => {
  try {
    const parsed = writeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const tx = await writeContractFunction({
      contractId: req.params.id,
      ...parsed.data,
    });
    res.status(202).json({ result: tx });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof Error && (err.message.includes("read-only") || err.message.includes("Missing argument"))) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});
