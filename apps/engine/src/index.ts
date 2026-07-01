import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";

import "./db/index.js"; // runs migrations on import
import { requireApiKey, requireAdminKey } from "./middleware/auth.js";
import { walletRouter } from "./routes/wallets.js";
import { transactionRouter } from "./routes/transactions.js";
import { chainRouter } from "./routes/chains.js";
import { apiKeyRouter } from "./routes/apiKeys.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "engine" });
const app = express();

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger: log }));

// Generous global limit; tighten per-API-key once you have real usage data.
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health check — unauthenticated, used by load balancers / Docker healthcheck.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// All API routes require a valid Engine access key (DB-issued or legacy allowlist).
app.use("/backend-wallet", requireApiKey, walletRouter);
app.use("/transaction", requireApiKey, transactionRouter);
app.use("/chain", requireApiKey, chainRouter);

// Key management requires the separate master admin key — see middleware/auth.ts.
app.use("/api-key", requireAdminKey, apiKeyRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 3005);
app.listen(port, () => {
  log.info(`Engine listening on http://localhost:${port}`);
  log.info(`Remember to run the worker separately: yarn workspace @apkaya/engine worker`);
});
