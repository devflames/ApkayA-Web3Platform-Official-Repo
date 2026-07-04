import "dotenv/config";
import pino from "pino";
import { getAdapterForRef } from "../adapters/registry.js";
import { runMigrations } from "../db/index.js";
import {
  claimQueuedTransactions,
  markSent,
  markMined,
  markReverted,
  markErrored,
  requeueForRetry,
  type TransactionRecord,
} from "../services/transactions.js";
import { fireWebhook } from "../services/webhooks.js";
import type { ChainRef } from "../services/chainRef.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "tx-worker" });

const POLL_INTERVAL_MS = Number(process.env.TX_WORKER_POLL_INTERVAL_MS ?? 2000);
const MAX_RETRIES = Number(process.env.TX_WORKER_MAX_RETRIES ?? 3);
const CONFIRMATION_TIMEOUT_MS = Number(process.env.TX_CONFIRMATION_TIMEOUT_MS ?? 120_000);
const BATCH_SIZE = 10;

function chainRefFromTx(tx: TransactionRecord): ChainRef {
  return { chainFamily: tx.chain_family, chainId: tx.chain_id };
}

async function processTransaction(tx: TransactionRecord): Promise<void> {
  const chainRef = chainRefFromTx(tx);
  const adapter = getAdapterForRef(chainRef);

  try {
    const pending = {
      chainRef,
      fromWalletId: tx.from_wallet_id,
      toAddress: tx.to_address,
      data: tx.data,
      valueAmount: tx.value_wei,
      extraMetadata: tx.extra_metadata ? JSON.parse(tx.extra_metadata) : undefined,
    };

    const sent = await adapter.signAndSend(pending);

    await markSent(tx.id, {
      txHash: sent.txHash,
      nonce: sent.nonce,
      gasLimit: sent.gasLimit,
      maxFeePerGas: sent.maxFeePerGas,
      maxPriorityFee: sent.maxPriorityFee,
    });

    log.info(
      { txId: tx.id, hash: sent.txHash, chainFamily: chainRef.chainFamily, chainId: chainRef.chainId },
      "transaction sent"
    );
    await fireWebhook(tx.id, "tx.sent", {
      hash: sent.txHash,
      chainFamily: chainRef.chainFamily,
      chainId: chainRef.chainId,
    });

    confirmTransaction(tx.id, sent.txHash, chainRef, adapter).catch((err) =>
      log.error({ txId: tx.id, err }, "confirmation watcher failed")
    );
  } catch (err) {
    if (adapter.onSendFailure) {
      await adapter.onSendFailure(chainRef, tx.from_wallet_id).catch(() => undefined);
    }

    const message = err instanceof Error ? err.message : String(err);
    log.warn({ txId: tx.id, err: message, retryCount: tx.retry_count }, "transaction send failed");

    if (tx.retry_count < MAX_RETRIES) {
      await requeueForRetry(tx.id);
    } else {
      await markErrored(tx.id, message, false);
      await fireWebhook(tx.id, "tx.errored", { error: message });
    }
  }
}

async function confirmTransaction(
  txId: string,
  hash: string,
  chainRef: ChainRef,
  adapter: ReturnType<typeof getAdapterForRef>
): Promise<void> {
  const result = await Promise.race([
    adapter.confirmTx(hash, chainRef),
    new Promise<{ status: "pending" }>((resolve) =>
      setTimeout(() => resolve({ status: "pending" }), CONFIRMATION_TIMEOUT_MS)
    ),
  ]);

  if (result.status === "pending") {
    log.warn({ txId, hash }, "confirmation timed out — will remain 'sent' until next check");
    return;
  }

  if (result.status === "mined" && result.cursor !== undefined) {
    await markMined(txId, result.cursor);
    log.info({ txId, hash, cursor: result.cursor }, "transaction mined");
    await fireWebhook(txId, "tx.mined", { hash, blockNumber: result.cursor });
  } else if (result.status === "reverted" && result.cursor !== undefined) {
    await markReverted(txId, result.cursor);
    log.warn({ txId, hash, cursor: result.cursor }, "transaction reverted");
    await fireWebhook(txId, "tx.reverted", { hash, blockNumber: result.cursor });
  }
}

async function loop(): Promise<void> {
  const batch = await claimQueuedTransactions(BATCH_SIZE);
  if (batch.length > 0) {
    log.debug({ count: batch.length }, "processing batch");
    await Promise.all(batch.map(processTransaction));
  }

  setTimeout(loop, POLL_INTERVAL_MS);
}

async function main(): Promise<void> {
  await runMigrations();
  log.info("transaction worker starting");
  loop();
}

main().catch((err) => {
  log.error({ err }, "worker failed to start");
  process.exit(1);
});
