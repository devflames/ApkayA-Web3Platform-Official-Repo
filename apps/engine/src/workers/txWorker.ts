import "dotenv/config";
import pino from "pino";
import { getProvider } from "../services/chains.js";
import { getSignerForWallet } from "../services/wallets.js";
import { NonceManager } from "../services/nonceManager.js";
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

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "tx-worker" });

const POLL_INTERVAL_MS = Number(process.env.TX_WORKER_POLL_INTERVAL_MS ?? 2000);
const MAX_RETRIES = Number(process.env.TX_WORKER_MAX_RETRIES ?? 3);
const CONFIRMATION_TIMEOUT_MS = Number(process.env.TX_CONFIRMATION_TIMEOUT_MS ?? 120_000);
const BATCH_SIZE = 10;
const nonceManager = new NonceManager((chainId) => getProvider(chainId));

async function processTransaction(tx: TransactionRecord): Promise<void> {
  const provider = getProvider(tx.chain_id);
  let reservedNonce: number | undefined;
  let signerAddress: string | undefined;

  try {
    const signer = await getSignerForWallet(tx.from_wallet_id, tx.chain_id);
    signerAddress = signer.address;

    const [feeData, nonce, gasEstimate] = await Promise.all([
      provider.getFeeData(),
      nonceManager.acquireNonce(tx.chain_id, signer.address),
      provider
        .estimateGas({ from: signer.address, to: tx.to_address, data: tx.data, value: BigInt(tx.value_wei) })
        .catch(() => 100_000n),
    ]);

    reservedNonce = nonce;

    const maxPriorityFeePerGas = ((feeData.maxPriorityFeePerGas ?? 1_500_000_000n) * 120n) / 100n;
    const maxFeePerGas = ((feeData.maxFeePerGas ?? 30_000_000_000n) * 120n) / 100n;
    const gasLimit = (gasEstimate * 120n) / 100n;

    const sent = await signer.sendTransaction({
      to: tx.to_address,
      data: tx.data,
      value: BigInt(tx.value_wei),
      nonce,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    await markSent(tx.id, {
      txHash: sent.hash,
      nonce,
      gasLimit: gasLimit.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFee: maxPriorityFeePerGas.toString(),
    });

    log.info({ txId: tx.id, hash: sent.hash, chainId: tx.chain_id, nonce }, "transaction sent");
    await fireWebhook(tx.id, "tx.sent", { hash: sent.hash, chainId: tx.chain_id });

    confirmTransaction(tx.id, sent.hash, tx.chain_id).catch((err) =>
      log.error({ txId: tx.id, err }, "confirmation watcher failed")
    );
  } catch (err) {
    if (reservedNonce !== undefined && signerAddress) {
      nonceManager.releaseNonce(tx.chain_id, signerAddress);
      await nonceManager.reconcile(tx.chain_id, signerAddress);
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

async function confirmTransaction(txId: string, hash: string, chainId: number): Promise<void> {
  const provider = getProvider(chainId);

  const receipt = await Promise.race([
    provider.waitForTransaction(hash, 1),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), CONFIRMATION_TIMEOUT_MS)),
  ]);

  if (!receipt) {
    log.warn({ txId, hash }, "confirmation timed out — will remain 'sent' until next check");
    return;
  }

  if (receipt.status === 1) {
    await markMined(txId, receipt.blockNumber);
    log.info({ txId, hash, block: receipt.blockNumber }, "transaction mined");
    await fireWebhook(txId, "tx.mined", { hash, blockNumber: receipt.blockNumber });
  } else {
    await markReverted(txId, receipt.blockNumber);
    log.warn({ txId, hash, block: receipt.blockNumber }, "transaction reverted");
    await fireWebhook(txId, "tx.reverted", { hash, blockNumber: receipt.blockNumber });
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
