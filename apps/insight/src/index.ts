import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { requireApiKey, rateLimitByApiKey } from "@apkaya/engine/platform";

import { runMigrations } from "./db/index.js";
import { insightRouter } from "./routes/insight.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "insight" });
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

app.use("/insight", requireApiKey, rateLimitByApiKey, insightRouter);

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

  const port = Number(process.env.PORT || 3006);
  app.listen(port, () => {
    log.info(`Insight API listening on http://localhost:${port}`);
    log.info(`Run the indexer worker separately: npm run worker --workspace=@apkaya/insight`);
  });
}

main().catch((err) => {
  log.error({ err }, "insight failed to start");
  process.exit(1);
});
