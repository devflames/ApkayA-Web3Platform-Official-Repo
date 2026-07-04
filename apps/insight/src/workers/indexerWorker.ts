import "dotenv/config";
import pino from "pino";
import { listChains } from "@apkaya/engine/platform";
import { runMigrations } from "../db/index.js";
import { indexChainConfig, pollIntervalMs } from "../indexers/registry.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "insight-worker" });

async function pollAllChains(): Promise<void> {
  const chains = listChains();
  for (const chain of chains) {
    try {
      await indexChainConfig(chain);
    } catch (err) {
      log.error(
        { err, chainFamily: chain.chainFamily, chainId: chain.chainId },
        "indexer tick failed"
      );
    }
  }
}

async function main(): Promise<void> {
  await runMigrations();
  log.info(
    {
      intervalMs: pollIntervalMs(),
      chains: listChains().map((c) => `${c.chainFamily}:${c.chainId}`),
    },
    "indexer worker started"
  );

  await pollAllChains();
  setInterval(() => {
    pollAllChains().catch((err) => log.error({ err }, "indexer poll loop error"));
  }, pollIntervalMs());
}

main().catch((err) => {
  log.error({ err }, "insight worker failed to start");
  process.exit(1);
});
