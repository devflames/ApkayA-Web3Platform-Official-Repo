import type { JsonRpcProvider } from "ethers";
import pino from "pino";
import { execute, query, queryOne } from "../db/index.js";
import {
  INDEXED_EVENT_TOPICS,
  decodeIndexedLog,
  normalizeAddress,
} from "./events.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "insight-indexer" });

export function blockChunkSize(): number {
  return Number(process.env.INSIGHT_BLOCK_CHUNK ?? 2000);
}

export function confirmations(): number {
  return Number(process.env.INSIGHT_CONFIRMATIONS ?? 3);
}

export function reorgCheckDepth(): number {
  return Number(process.env.INSIGHT_REORG_CHECK_DEPTH ?? 64);
}

export function pollIntervalMs(): number {
  return Number(process.env.INSIGHT_POLL_INTERVAL_MS ?? 5000);
}

function bootstrapLookback(): number {
  return Number(process.env.INSIGHT_BOOTSTRAP_LOOKBACK ?? 10_000);
}

function startBlockForChain(chainId: number): number {
  const perChain = process.env[`CHAIN_${chainId}_INSIGHT_START_BLOCK`];
  if (perChain !== undefined) return Number(perChain);
  if (process.env.INSIGHT_START_BLOCK !== undefined) return Number(process.env.INSIGHT_START_BLOCK);
  return 0;
}

interface IndexerStateRow {
  chain_id: number;
  last_indexed_block: string;
}

interface BlockHashRow {
  block_number: string;
  block_hash: string;
}

export async function getIndexerState(chainId: number): Promise<IndexerStateRow> {
  const row = await queryOne<IndexerStateRow>(
    "SELECT chain_id, last_indexed_block::text FROM indexer_state WHERE chain_id = $1",
    [chainId]
  );
  if (row) return row;
  return { chain_id: chainId, last_indexed_block: "0" };
}

async function setLastIndexedBlock(chainId: number, blockNumber: number): Promise<void> {
  await execute(
    `INSERT INTO indexer_state (chain_id, last_indexed_block, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (chain_id) DO UPDATE
     SET last_indexed_block = EXCLUDED.last_indexed_block, updated_at = NOW()`,
    [chainId, blockNumber]
  );
}

async function recordBlockHash(chainId: number, blockNumber: number, blockHash: string): Promise<void> {
  await execute(
    `INSERT INTO indexer_block_hashes (chain_id, block_number, block_hash, recorded_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (chain_id, block_number) DO UPDATE
     SET block_hash = EXCLUDED.block_hash, recorded_at = NOW()`,
    [chainId, blockNumber, blockHash]
  );
}

export async function rollbackFromBlock(chainId: number, fromBlock: number): Promise<void> {
  log.warn({ chainId, fromBlock }, "reorg detected — rolling back indexed events");
  await execute("DELETE FROM events WHERE chain_id = $1 AND block_number >= $2", [chainId, fromBlock]);
  await execute("DELETE FROM indexer_block_hashes WHERE chain_id = $1 AND block_number >= $2", [
    chainId,
    fromBlock,
  ]);
  await setLastIndexedBlock(chainId, fromBlock - 1);
}

export async function detectReorg(chainId: number, provider: JsonRpcProvider): Promise<number | null> {
  const state = await getIndexerState(chainId);
  const lastIndexed = Number(state.last_indexed_block);
  if (lastIndexed <= 0) return null;

  const depth = reorgCheckDepth();
  const fromBlock = Math.max(0, lastIndexed - depth);

  const stored = await query<BlockHashRow>(
    `SELECT block_number::text, block_hash
     FROM indexer_block_hashes
     WHERE chain_id = $1 AND block_number >= $2 AND block_number <= $3
     ORDER BY block_number ASC`,
    [chainId, fromBlock, lastIndexed]
  );

  for (const row of stored) {
    const blockNumber = Number(row.block_number);
    const block = await provider.getBlock(blockNumber);
    if (!block?.hash) continue;
    if (block.hash !== row.block_hash) {
      return blockNumber;
    }
  }

  return null;
}

async function resolveStartBlock(chainId: number, provider: JsonRpcProvider): Promise<number> {
  const state = await getIndexerState(chainId);
  const lastIndexed = Number(state.last_indexed_block);
  if (lastIndexed > 0) return lastIndexed + 1;

  const configured = startBlockForChain(chainId);
  if (configured > 0) return configured;

  const head = await provider.getBlockNumber();
  return Math.max(0, head - bootstrapLookback());
}

export async function indexChain(chainId: number, provider: JsonRpcProvider): Promise<void> {
  const reorgAt = await detectReorg(chainId, provider);
  if (reorgAt !== null) {
    await rollbackFromBlock(chainId, reorgAt);
  }

  const head = await provider.getBlockNumber();
  const safeHead = head - confirmations();
  if (safeHead < 0) return;

  let fromBlock = await resolveStartBlock(chainId, provider);
  if (fromBlock > safeHead) return;

  const chunk = blockChunkSize();

  while (fromBlock <= safeHead) {
    const toBlock = Math.min(fromBlock + chunk - 1, safeHead);

    const logs = await provider.getLogs({
      fromBlock,
      toBlock,
      topics: [INDEXED_EVENT_TOPICS],
    });

    const blockHashCache = new Map<number, string>();

    for (const entry of logs) {
      const decoded = decodeIndexedLog(entry.topics, entry.data);
      if (!decoded) continue;

      const blockNumber = entry.blockNumber;
      let blockHash = blockHashCache.get(blockNumber);
      if (!blockHash) {
        const block = await provider.getBlock(blockNumber);
        blockHash = block?.hash ?? "";
        if (blockHash) blockHashCache.set(blockNumber, blockHash);
      }

      await execute(
        `INSERT INTO events (
           chain_id, block_number, block_hash, tx_hash, log_index,
           contract_address, event_name, decoded_args_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING`,
        [
          chainId,
          blockNumber,
          blockHash,
          entry.transactionHash,
          entry.index,
          normalizeAddress(entry.address),
          decoded.eventName,
          JSON.stringify(decoded.args),
        ]
      );
    }

    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
      let blockHash = blockHashCache.get(blockNumber);
      if (!blockHash) {
        const block = await provider.getBlock(blockNumber);
        blockHash = block?.hash ?? "";
      }
      if (blockHash) {
        await recordBlockHash(chainId, blockNumber, blockHash);
      }
    }

    await setLastIndexedBlock(chainId, toBlock);
    log.info({ chainId, fromBlock, toBlock, logs: logs.length }, "indexed block range");

    fromBlock = toBlock + 1;
  }
}
