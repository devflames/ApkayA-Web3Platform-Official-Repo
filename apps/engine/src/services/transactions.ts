import { nanoid } from "nanoid";
import { db } from "../db/index.js";

export interface EnqueueTxInput {
  chainId: number;
  fromWalletId: string;
  toAddress: string;
  data?: string;
  valueWei?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionRecord {
  id: string;
  idempotency_key: string | null;
  chain_id: number;
  from_wallet_id: string;
  to_address: string;
  data: string;
  value_wei: string;
  gas_limit: string | null;
  max_fee_per_gas: string | null;
  max_priority_fee: string | null;
  nonce: number | null;
  tx_hash: string | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  extra_metadata: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  mined_at: string | null;
  block_number: number | null;
}

/**
 * Enqueues a transaction. If an idempotencyKey is supplied and already
 * exists, returns the existing record instead of creating a duplicate —
 * this lets API clients safely retry on network failure.
 */
export function enqueueTransaction(input: EnqueueTxInput): TransactionRecord {
  if (input.idempotencyKey) {
    const existing = db
      .prepare(`SELECT * FROM transactions WHERE idempotency_key = ?`)
      .get(input.idempotencyKey) as TransactionRecord | undefined;
    if (existing) return existing;
  }

  const id = nanoid();

  db.prepare(
    `INSERT INTO transactions
      (id, idempotency_key, chain_id, from_wallet_id, to_address, data, value_wei, extra_metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.idempotencyKey ?? null,
    input.chainId,
    input.fromWalletId,
    input.toAddress,
    input.data ?? "0x",
    input.valueWei ?? "0",
    input.metadata ? JSON.stringify(input.metadata) : null
  );

  return getTransaction(id)!;
}

export function getTransaction(id: string): TransactionRecord | undefined {
  return db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id) as
    | TransactionRecord
    | undefined;
}

export function listTransactions(filters: {
  status?: string;
  walletId?: string;
  chainId?: number;
  limit?: number;
}): TransactionRecord[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.walletId) {
    clauses.push("from_wallet_id = ?");
    params.push(filters.walletId);
  }
  if (filters.chainId) {
    clauses.push("chain_id = ?");
    params.push(filters.chainId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(filters.limit ?? 50, 200);

  return db
    .prepare(`SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as TransactionRecord[];
}

/** Marks a queued transaction as cancelled. No-op (returns false) if it has already been sent. */
export function cancelTransaction(id: string): boolean {
  const result = db
    .prepare(`UPDATE transactions SET status = 'cancelled', updated_at = datetime('now')
              WHERE id = ? AND status = 'queued'`)
    .run(id);
  return result.changes > 0;
}

/** Pulls the oldest queued transactions for the worker to process, oldest-first (FIFO per wallet). */
export function claimQueuedTransactions(limit: number): TransactionRecord[] {
  return db
    .prepare(`SELECT * FROM transactions WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?`)
    .all(limit) as TransactionRecord[];
}

export function markSent(
  id: string,
  fields: { txHash: string; nonce: number; gasLimit: string; maxFeePerGas: string; maxPriorityFee: string }
): void {
  db.prepare(
    `UPDATE transactions
     SET status = 'sent', tx_hash = ?, nonce = ?, gas_limit = ?, max_fee_per_gas = ?,
         max_priority_fee = ?, sent_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(fields.txHash, fields.nonce, fields.gasLimit, fields.maxFeePerGas, fields.maxPriorityFee, id);
}

export function markMined(id: string, blockNumber: number): void {
  db.prepare(
    `UPDATE transactions
     SET status = 'mined', block_number = ?, mined_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(blockNumber, id);
}

export function markReverted(id: string, blockNumber: number): void {
  db.prepare(
    `UPDATE transactions
     SET status = 'reverted', block_number = ?, mined_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(blockNumber, id);
}

export function markErrored(id: string, errorMessage: string, incrementRetry: boolean): void {
  db.prepare(
    `UPDATE transactions
     SET status = 'errored', error_message = ?, updated_at = datetime('now'),
         retry_count = retry_count + ?
     WHERE id = ?`
  ).run(errorMessage, incrementRetry ? 1 : 0, id);
}

export function requeueForRetry(id: string): void {
  db.prepare(
    `UPDATE transactions
     SET status = 'queued', updated_at = datetime('now'), retry_count = retry_count + 1
     WHERE id = ?`
  ).run(id);
}
