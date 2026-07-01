import { Router } from "express";
import { z } from "zod";
import { createApiKey, listApiKeys, getApiKey, revokeApiKey, reactivateApiKey } from "../services/apiKeys.js";

export const apiKeyRouter = Router();

const createSchema = z.object({
  label: z.string().min(1).max(100),
});

apiKeyRouter.post("/create", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

    const { record, rawKey } = await createApiKey(parsed.data.label);
    res.status(201).json({ result: { ...record, key: rawKey } });
  } catch (err) {
    next(err);
  }
});

apiKeyRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ result: await listApiKeys() });
  } catch (err) {
    next(err);
  }
});

apiKeyRouter.get("/:id", async (req, res, next) => {
  try {
    const key = await getApiKey(req.params.id);
    if (!key) return res.status(404).json({ error: "API key not found" });
    res.json({ result: key });
  } catch (err) {
    next(err);
  }
});

apiKeyRouter.post("/:id/revoke", async (req, res, next) => {
  try {
    const revoked = await revokeApiKey(req.params.id);
    if (!revoked) {
      return res.status(409).json({ error: "Key not found or already revoked" });
    }
    res.json({ result: { id: req.params.id, is_active: false } });
  } catch (err) {
    next(err);
  }
});

apiKeyRouter.post("/:id/reactivate", async (req, res, next) => {
  try {
    const reactivated = await reactivateApiKey(req.params.id);
    if (!reactivated) {
      return res.status(409).json({ error: "Key not found or already active" });
    }
    res.json({ result: { id: req.params.id, is_active: true } });
  } catch (err) {
    next(err);
  }
});
