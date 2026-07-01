import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";

import { runMigrations } from "./db/index.js";
import { requireApiKey, requireAdminKey } from "./middleware/auth.js";
import { rateLimitByApiKey } from "./middleware/rateLimit.js";
import { walletRouter } from "./routes/wallets.js";
import { transactionRouter } from "./routes/transactions.js";
import { chainRouter } from "./routes/chains.js";
import { apiKeyRouter } from "./routes/apiKeys.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "engine" });
const app = express();

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger: log }));

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.GLOBAL_IP_RATE_LIMIT_PER_MINUTE ?? 600),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health",
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/backend-wallet", requireApiKey, rateLimitByApiKey, walletRouter);
app.use("/transaction", requireApiKey, rateLimitByApiKey, transactionRouter);
app.use("/chain", requireApiKey, rateLimitByApiKey, chainRouter);
app.use("/api-key", requireAdminKey, apiKeyRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

async function main(): Promise<void> {
  await runMigrations();

  const port = Number(process.env.PORT || 3005);
  app.listen(port, () => {
    log.info(`Engine listening on http://localhost:${port}`);
    log.info(`Remember to run the worker separately: npm run worker --workspace=@apkaya/engine`);
  });
}

main().catch((err) => {
  log.error({ err }, "engine failed to start");
  process.exit(1);
});
