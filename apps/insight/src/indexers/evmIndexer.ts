import type { JsonRpcProvider } from "ethers";
import pino from "pino";
import { execute, query, queryOne } from "../db/index.js";
import type { ChainRef } from "@apkaya/engine/platform";
import {
  INDEXED_EVENT_TOPICS,
  decodeIndexedLog,
  normalizeAddress,
} from "../services/events.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "insight-evm-indexer" });

export function blockChunkSize(): number {
  return Number(process.env.INSIGHT_BLOCK_CHUNK ?? 2000);
}

export function confirmations(): number {
  return Number(process.env.INSIGHT_CONFIRMATIONS ?? 3);
}

export function reorgCheckDepth(): number {
  return Number(process.env.INSIGHT_REORG_CHECK_DEPTH ?? 64);
}

function bootstrapLookback(): number {
  return Number(process.env.INSIGHT_BOOTSTRAP_LOOKBACK ?? 10_000);
}

function startBlockForChain(chainRef: ChainRef): number {
  const perChain = process.env[`CHAIN_${chainRef.chainId}_INSIGHT_START_BLOCK`];
  if (perChain !== undefined) return Number(perChain);
  if (process.env.INSIGHT_START_BLOCK !== undefined) return Number(process.env.INSIGHT_START_BLOCK);
  return 0;
}

interface IndexerStateRow {
  chain_family: string;
  chain_id: string;
  last_indexed_cursor: string;
}

interface BlockHashRow {
  block_number: string;
  block_hash: string;
}

async function getIndexerState(chainRef: ChainRef): Promise<IndexerStateRow> {
  const row = await queryOne<IndexerStateRow>(
    `SELECT chain_family, chain_id, last_indexed_cursor::text
     FROM indexer_state WHERE chain_family = $1 AND chain_id = $2`,
    [chainRef.chainFamily, chainRef.chainId]
  );
  if (row) return row;
  return {
    chain_family: chainRef.chainFamily,
    chain_id: chainRef.chainId,
    last_indexed_cursor: "0",
  };
}

async function setLastIndexedCursor(chainRef: ChainRef, cursor: number): Promise<void> {
  await execute(
    `INSERT INTO indexer_state (chain_family, chain_id, last_indexed_cursor, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (chain_family, chain_id) DO UPDATE
     SET last_indexed_cursor = EXCLUDED.last_indexed_cursor, updated_at = NOW()`,
    [chainRef.chainFamily, chainRef.chainId, cursor]
  );
}

async function recordBlockHash(
  chainRef: ChainRef,
  blockNumber: number,
  blockHash: string
): Promise<void> {
  await execute(
    `INSERT INTO indexer_block_hashes (chain_family, chain_id, block_number, block_hash, recorded_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (chain_family, chain_id, block_number) DO UPDATE
     SET block_hash = EXCLUDED.block_hash, recorded_at = NOW()`,
    [chainRef.chainFamily, chainRef.chainId, blockNumber, blockHash]
  );
}

async function rollbackFromBlock(chainRef: ChainRef, fromBlock: number): Promise<void> {
  log.warn({ chainRef, fromBlock }, "reorg detected — rolling back indexed events");
  await execute(
    "DELETE FROM events WHERE chain_family = $1 AND chain_id = $2 AND block_number >= $3",
    [chainRef.chainFamily, chainRef.chainId, fromBlock]
  );
  await execute(
    "DELETE FROM indexer_block_hashes WHERE chain_family = $1 AND chain_id = $2 AND block_number >= $3",
    [chainRef.chainFamily, chainRef.chainId, fromBlock]
  );
  await setLastIndexedCursor(chainRef, fromBlock - 1);
}

async function detectReorg(chainRef: ChainRef, provider: JsonRpcProvider): Promise<number | null> {
  const state = await getIndexerState(chainRef);
  const lastIndexed = Number(state.last_indexed_cursor);
  if (lastIndexed <= 0) return null;

  const depth = reorgCheckDepth();
  const fromBlock = Math.max(0, lastIndexed - depth);

  const stored = await query<BlockHashRow>(
    `SELECT block_number::text, block_hash
     FROM indexer_block_hashes
     WHERE chain_family = $1 AND chain_id = $2 AND block_number >= $3 AND block_number <= $4
     ORDER BY block_number ASC`,
    [chainRef.chainFamily, chainRef.chainId, fromBlock, lastIndexed]
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

async function resolveStartBlock(chainRef: ChainRef, provider: JsonRpcProvider): Promise<number> {
  const state = await getIndexerState(chainRef);
  const lastIndexed = Number(state.last_indexed_cursor);
  if (lastIndexed > 0) return lastIndexed + 1;

  const configured = startBlockForChain(chainRef);
  if (configured > 0) return configured;

  const head = await provider.getBlockNumber();
  return Math.max(0, head - bootstrapLookback());
}

export async function indexEvmChain(chainRef: ChainRef, provider: JsonRpcProvider): Promise<void> {
  const reorgAt = await detectReorg(chainRef, provider);
  if (reorgAt !== null) {
    await rollbackFromBlock(chainRef, reorgAt);
  }

  const head = await provider.getBlockNumber();
  const safeHead = head - confirmations();
  if (safeHead < 0) return;

  let fromBlock = await resolveStartBlock(chainRef, provider);
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
           chain_family, chain_id, block_number, block_hash, tx_hash, log_index,
           contract_address, event_name, decoded_args_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (chain_family, chain_id, tx_hash, log_index) DO NOTHING`,
        [
          chainRef.chainFamily,
          chainRef.chainId,
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
        await recordBlockHash(chainRef, blockNumber, blockHash);
      }
    }

    await setLastIndexedCursor(chainRef, toBlock);
    log.info({ chainRef, fromBlock, toBlock, logs: logs.length }, "indexed EVM block range");

    fromBlock = toBlock + 1;
  }
}
