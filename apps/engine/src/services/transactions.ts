import { nanoid } from "nanoid";
import { execute, query, queryOne } from "../db/index.js";
import { serializeRow, serializeRows } from "../db/serialize.js";
import type { ChainFamily } from "./chainRef.js";
import { resolveChainRef } from "./chainRef.js";

export interface EnqueueTxInput {
  chainFamily?: ChainFamily;
  chainId: string | number;
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
  chain_family: ChainFamily;
  chain_id: string;
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

export async function enqueueTransaction(input: EnqueueTxInput): Promise<TransactionRecord> {
  if (input.idempotencyKey) {
    const existing = await queryOne<TransactionRecord>(
      `SELECT * FROM transactions WHERE idempotency_key = $1`,
      [input.idempotencyKey]
    );
    if (existing) return serializeRow(existing);
  }

  const chainRef = resolveChainRef(input);
  const id = nanoid();

  await execute(
    `INSERT INTO transactions
      (id, idempotency_key, chain_family, chain_id, from_wallet_id, to_address, data, value_wei, extra_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.idempotencyKey ?? null,
      chainRef.chainFamily,
      chainRef.chainId,
      input.fromWalletId,
      input.toAddress,
      input.data ?? (chainRef.chainFamily === "evm" ? "0x" : ""),
      input.valueWei ?? "0",
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );

  const tx = await getTransaction(id);
  if (!tx) throw new Error("Failed to enqueue transaction.");
  return tx;
}

export async function getTransaction(id: string): Promise<TransactionRecord | undefined> {
  const row = await queryOne<TransactionRecord>(`SELECT * FROM transactions WHERE id = $1`, [id]);
  return row ? serializeRow(row) : undefined;
}

export async function listTransactions(filters: {
  status?: string;
  walletId?: string;
  chainFamily?: ChainFamily;
  chainId?: string;
  limit?: number;
}): Promise<TransactionRecord[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    clauses.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.walletId) {
    clauses.push(`from_wallet_id = $${paramIndex++}`);
    params.push(filters.walletId);
  }
  if (filters.chainFamily) {
    clauses.push(`chain_family = $${paramIndex++}`);
    params.push(filters.chainFamily);
  }
  if (filters.chainId) {
    clauses.push(`chain_id = $${paramIndex++}`);
    params.push(filters.chainId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(filters.limit ?? 50, 200);
  params.push(limit);

  const rows = await query<TransactionRecord>(
    `SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT $${paramIndex}`,
    params
  );
  return serializeRows(rows);
}

export async function cancelTransaction(id: string): Promise<boolean> {
  const changes = await execute(
    `UPDATE transactions SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status = 'queued'`,
    [id]
  );
  return changes > 0;
}

export async function claimQueuedTransactions(limit: number): Promise<TransactionRecord[]> {
  const rows = await query<TransactionRecord>(
    `SELECT * FROM transactions WHERE status = 'queued' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  return serializeRows(rows);
}

export async function markSent(
  id: string,
  fields: {
    txHash: string;
    nonce?: number;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFee?: string;
  }
): Promise<void> {
  await execute(
    `UPDATE transactions
     SET status = 'sent', tx_hash = $1, nonce = $2, gas_limit = $3, max_fee_per_gas = $4,
         max_priority_fee = $5, sent_at = NOW(), updated_at = NOW()
     WHERE id = $6`,
    [
      fields.txHash,
      fields.nonce ?? null,
      fields.gasLimit ?? null,
      fields.maxFeePerGas ?? null,
      fields.maxPriorityFee ?? null,
      id,
    ]
  );
}

export async function markMined(id: string, blockNumber: number): Promise<void> {
  await execute(
    `UPDATE transactions
     SET status = 'mined', block_number = $1, mined_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [blockNumber, id]
  );
}

export async function markReverted(id: string, blockNumber: number): Promise<void> {
  await execute(
    `UPDATE transactions
     SET status = 'reverted', block_number = $1, mined_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [blockNumber, id]
  );
}

export async function markErrored(id: string, errorMessage: string, incrementRetry: boolean): Promise<void> {
  await execute(
    `UPDATE transactions
     SET status = 'errored', error_message = $1, updated_at = NOW(),
         retry_count = retry_count + $2
     WHERE id = $3`,
    [errorMessage, incrementRetry ? 1 : 0, id]
  );
}

export async function requeueForRetry(id: string): Promise<void> {
  await execute(
    `UPDATE transactions
     SET status = 'queued', updated_at = NOW(), retry_count = retry_count + 1
     WHERE id = $1`,
    [id]
  );
}
