import { Router } from "express";
import { z } from "zod";
import { createSiweNonce, verifySiweSignature } from "../services/siwe.js";
import { requestEmailOtp, verifyEmailOtp } from "../services/emailOtp.js";
import { upsertEmailEndUser, upsertSiweEndUser } from "../services/endUsers.js";
import { requireSession } from "../middleware/sessionAuth.js";
import { getSignerForWallet } from "../services/wallets.js";
import { enqueueTransaction } from "../services/transactions.js";
import { listChains } from "../services/chains.js";

export const authRouter = Router();

const siweNonceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive(),
  domain: z.string().min(1).max(253),
  uri: z.string().url(),
  statement: z.string().optional(),
});

const siweVerifySchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

const emailRequestSchema = z.object({
  email: z.string().email(),
});

const emailVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
});

const signMessageSchema = z.object({
  message: z.string().min(1),
});

const sendTxSchema = z.object({
  chainId: z.number().int().positive(),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/).optional(),
  valueWei: z.string().regex(/^\d+$/).optional(),
  idempotencyKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function sessionResponse(result: Awaited<ReturnType<typeof upsertEmailEndUser>>) {
  return {
    sessionToken: result.sessionToken,
    expiresAt: result.expiresAt,
    address: result.endUser.primary_address,
    authMethod: result.endUser.auth_method,
    endUserId: result.endUser.id,
    backendWalletId: result.endUser.backend_wallet_id,
  };
}

authRouter.post("/siwe/nonce", async (req, res, next) => {
  try {
    const parsed = siweNonceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    if (!listChains().some((c) => c.chainId === parsed.data.chainId)) {
      return res.status(400).json({ error: `Chain ${parsed.data.chainId} is not configured.` });
    }

    const result = await createSiweNonce(parsed.data);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/siwe/verify", async (req, res, next) => {
  try {
    const parsed = siweVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const verified = await verifySiweSignature(parsed.data);
    const session = await upsertSiweEndUser(verified.address);
    res.json({ result: sessionResponse(session) });
  } catch (err) {
    if (err instanceof Error && err.message.includes("SIWE")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

authRouter.post("/email/request-code", async (req, res, next) => {
  try {
    const parsed = emailRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const result = await requestEmailOtp(parsed.data.email);
    res.json({ result });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid email")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

authRouter.post("/email/verify-code", async (req, res, next) => {
  try {
    const parsed = emailVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    await verifyEmailOtp(parsed.data.email, parsed.data.code);
    const session = await upsertEmailEndUser(parsed.data.email);
    res.json({ result: sessionResponse(session) });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

authRouter.get("/session", requireSession, async (req, res) => {
  res.json({
    result: {
      endUserId: req.endUser!.id,
      address: req.endUser!.primary_address,
      authMethod: req.endUser!.auth_method,
      backendWalletId: req.endUser!.backend_wallet_id,
      email: req.endUser!.email,
    },
  });
});

authRouter.post("/in-app/sign-message", requireSession, async (req, res, next) => {
  try {
    const parsed = signMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const endUser = req.endUser!;
    if (endUser.auth_method !== "email" || !endUser.backend_wallet_id) {
      return res.status(400).json({ error: "In-app signing requires an email-backed wallet session." });
    }

    const chainId = Number(process.env.DEFAULT_CHAIN_ID ?? listChains()[0]?.chainId ?? 1);
    const signer = await getSignerForWallet(endUser.backend_wallet_id, chainId);
    const signature = await signer.signMessage(parsed.data.message);
    res.json({ result: { signature } });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/in-app/send-transaction", requireSession, async (req, res, next) => {
  try {
    const parsed = sendTxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const endUser = req.endUser!;
    if (endUser.auth_method !== "email" || !endUser.backend_wallet_id) {
      return res.status(400).json({ error: "In-app transactions require an email-backed wallet session." });
    }

    if (!listChains().some((c) => c.chainId === parsed.data.chainId)) {
      return res.status(400).json({ error: `Chain ${parsed.data.chainId} is not configured.` });
    }

    const tx = await enqueueTransaction({
      chainId: parsed.data.chainId,
      fromWalletId: endUser.backend_wallet_id,
      toAddress: parsed.data.toAddress,
      data: parsed.data.data ?? "0x",
      valueWei: parsed.data.valueWei ?? "0",
      idempotencyKey: parsed.data.idempotencyKey,
      metadata: {
        endUserId: endUser.id,
        authMethod: endUser.auth_method,
        ...parsed.data.metadata,
      },
    });

    res.status(202).json({ result: tx });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/in-app/wallet", requireSession, async (req, res) => {
  const endUser = req.endUser!;
  res.json({
    result: {
      address: endUser.primary_address,
      backendWalletId: endUser.backend_wallet_id,
    },
  });
});
