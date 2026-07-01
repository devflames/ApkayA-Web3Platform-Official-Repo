import { Router } from "express";
import { z } from "zod";
import { createApiKey, listApiKeys, getApiKey, revokeApiKey, reactivateApiKey } from "../services/apiKeys.js";

export const apiKeyRouter = Router();

const createSchema = z.object({
  label: z.string().min(1).max(100),
});

// POST /api-key/create
apiKeyRouter.post("/create", (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const { record, rawKey } = createApiKey(parsed.data.label);

  // rawKey is included only in this single response — it is never
  // retrievable again. The client must store it now.
  res.status(201).json({ result: { ...record, key: rawKey } });
});

// GET /api-key
apiKeyRouter.get("/", (_req, res) => {
  res.json({ result: listApiKeys() });
});

// GET /api-key/:id
apiKeyRouter.get("/:id", (req, res) => {
  const key = getApiKey(req.params.id);
  if (!key) return res.status(404).json({ error: "API key not found" });
  res.json({ result: key });
});

// POST /api-key/:id/revoke
apiKeyRouter.post("/:id/revoke", (req, res) => {
  const revoked = revokeApiKey(req.params.id);
  if (!revoked) {
    return res.status(409).json({ error: "Key not found or already revoked" });
  }
  res.json({ result: { id: req.params.id, is_active: false } });
});

// POST /api-key/:id/reactivate
apiKeyRouter.post("/:id/reactivate", (req, res) => {
  const reactivated = reactivateApiKey(req.params.id);
  if (!reactivated) {
    return res.status(409).json({ error: "Key not found or already active" });
  }
  res.json({ result: { id: req.params.id, is_active: true } });
});
