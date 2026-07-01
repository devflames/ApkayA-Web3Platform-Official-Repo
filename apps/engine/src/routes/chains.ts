import { Router } from "express";
import { listChains } from "../services/chains.js";

export const chainRouter = Router();

// GET /chain
chainRouter.get("/", (_req, res) => {
  res.json({ result: listChains() });
});
