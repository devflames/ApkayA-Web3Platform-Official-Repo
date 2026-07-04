import type { Connection } from "@solana/web3.js";
import pino from "pino";
import type { ChainRef } from "@apkaya/engine/platform";
import { execute, query, queryOne } from "../db/index.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "insight-solana-indexer" });

const NATIVE_SOL_MINT = "11111111111111111111111111111111";

function slotChunkSize(): number {
  return Number(process.env.INSIGHT_SLOT_CHUNK ?? 100);
}

function confirmations(): number {
  return Number(process.env.INSIGHT_CONFIRMATIONS ?? 32);
}

function reorgCheckDepth(): number {
  return Number(process.env.INSIGHT_REORG_CHECK_DEPTH ?? 128);
}

function bootstrapLookback(): number {
  return Number(process.env.INSIGHT_BOOTSTRAP_LOOKBACK ?? 5_000);
}

interface IndexerStateRow {
  last_indexed_cursor: string;
}

async function getIndexerState(chainRef: ChainRef): Promise<IndexerStateRow> {
  const row = await queryOne<IndexerStateRow>(
    `SELECT last_indexed_cursor::text FROM indexer_state WHERE chain_family = $1 AND chain_id = $2`,
    [chainRef.chainFamily, chainRef.chainId]
  );
  return row ?? { last_indexed_cursor: "0" };
}

async function setLastIndexedCursor(chainRef: ChainRef, slot: number): Promise<void> {
  await execute(
    `INSERT INTO indexer_state (chain_family, chain_id, last_indexed_cursor, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (chain_family, chain_id) DO UPDATE
     SET last_indexed_cursor = EXCLUDED.last_indexed_cursor, updated_at = NOW()`,
    [chainRef.chainFamily, chainRef.chainId, slot]
  );
}

async function recordSlotHash(chainRef: ChainRef, slot: number, blockhash: string): Promise<void> {
  await execute(
    `INSERT INTO indexer_block_hashes (chain_family, chain_id, block_number, block_hash, recorded_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (chain_family, chain_id, block_number) DO UPDATE
     SET block_hash = EXCLUDED.block_hash, recorded_at = NOW()`,
    [chainRef.chainFamily, chainRef.chainId, slot, blockhash]
  );
}

async function rollbackFromSlot(chainRef: ChainRef, fromSlot: number): Promise<void> {
  log.warn({ chainRef, fromSlot }, "Solana reorg — rolling back indexed events");
  await execute(
    "DELETE FROM events WHERE chain_family = $1 AND chain_id = $2 AND block_number >= $3",
    [chainRef.chainFamily, chainRef.chainId, fromSlot]
  );
  await execute(
    "DELETE FROM indexer_block_hashes WHERE chain_family = $1 AND chain_id = $2 AND block_number >= $3",
    [chainRef.chainFamily, chainRef.chainId, fromSlot]
  );
  await setLastIndexedCursor(chainRef, fromSlot - 1);
}

async function detectReorg(chainRef: ChainRef, connection: Connection): Promise<number | null> {
  const state = await getIndexerState(chainRef);
  const lastIndexed = Number(state.last_indexed_cursor);
  if (lastIndexed <= 0) return null;

  const fromSlot = Math.max(0, lastIndexed - reorgCheckDepth());
  const rows = await query<{ block_number: string; block_hash: string }>(
    `SELECT block_number::text, block_hash FROM indexer_block_hashes
     WHERE chain_family = $1 AND chain_id = $2 AND block_number >= $3 AND block_number <= $4
     ORDER BY block_number ASC`,
    [chainRef.chainFamily, chainRef.chainId, fromSlot, lastIndexed]
  );

  for (const row of rows) {
    const slot = Number(row.block_number);
    const blocks = await connection.getBlocks(slot, slot);
    if (blocks.length === 0) continue;
    const block = await connection.getBlock(slot, { maxSupportedTransactionVersion: 0 });
    if (block?.blockhash && block.blockhash !== row.block_hash) {
      return slot;
    }
  }
  return null;
}

async function resolveStartSlot(chainRef: ChainRef, connection: Connection): Promise<number> {
  const state = await getIndexerState(chainRef);
  const lastIndexed = Number(state.last_indexed_cursor);
  if (lastIndexed > 0) return lastIndexed + 1;

  const perChain = process.env[`CHAIN_${chainRef.chainId}_INSIGHT_START_BLOCK`];
  if (perChain !== undefined) return Number(perChain);

  const head = await connection.getSlot("confirmed");
  return Math.max(0, head - bootstrapLookback());
}

export async function indexSolanaChain(chainRef: ChainRef, connection: Connection): Promise<void> {
  const reorgAt = await detectReorg(chainRef, connection);
  if (reorgAt !== null) {
    await rollbackFromSlot(chainRef, reorgAt);
  }

  const head = await connection.getSlot("confirmed");
  const safeHead = head - confirmations();
  if (safeHead < 0) return;

  let fromSlot = await resolveStartSlot(chainRef, connection);
  if (fromSlot > safeHead) return;

  const chunk = slotChunkSize();

  while (fromSlot <= safeHead) {
    const toSlot = Math.min(fromSlot + chunk - 1, safeHead);
    let eventCount = 0;

    for (let slot = fromSlot; slot <= toSlot; slot += 1) {
      const block = await connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: "full",
        rewards: false,
      });
      if (!block) continue;

      await recordSlotHash(chainRef, slot, block.blockhash);

      for (let txIndex = 0; txIndex < block.transactions.length; txIndex += 1) {
        const tx = block.transactions[txIndex]!;
        const signature = tx.transaction.signatures[0];
        if (!signature || !tx.meta) continue;

        const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) =>
          k.toBase58()
        );

        // Native SOL balance diffs
        if (tx.meta.preBalances && tx.meta.postBalances) {
          for (let i = 0; i < accountKeys.length; i += 1) {
            const delta = tx.meta.postBalances[i]! - tx.meta.preBalances[i]!;
            if (delta === 0) continue;
            const from =
              delta < 0 ? accountKeys[i]! : accountKeys.find((_, j) => tx.meta!.postBalances![j]! - tx.meta!.preBalances![j]! > 0) ?? "";
            const to = delta > 0 ? accountKeys[i]! : from;
            if (!from || !to || from === to) continue;

            await execute(
              `INSERT INTO events (
                 chain_family, chain_id, block_number, block_hash, tx_hash, log_index,
                 contract_address, event_name, decoded_args_json
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
               ON CONFLICT (chain_family, chain_id, tx_hash, log_index) DO NOTHING`,
              [
                chainRef.chainFamily,
                chainRef.chainId,
                slot,
                block.blockhash,
                signature,
                txIndex,
                NATIVE_SOL_MINT,
                "SolTransfer",
                JSON.stringify({
                  from: delta < 0 ? accountKeys[i] : to,
                  to: delta > 0 ? accountKeys[i] : from,
                  value: String(Math.abs(delta)),
                }),
              ]
            );
            eventCount += 1;
          }
        }

        // SPL token balance diffs via meta
        const pre = tx.meta.preTokenBalances ?? [];
        const post = tx.meta.postTokenBalances ?? [];
        const mintDeltas = new Map<string, { owner: string; mint: string; delta: bigint }>();

        for (const entry of pre) {
          const key = `${entry.mint}:${entry.owner}`;
          mintDeltas.set(key, {
            owner: entry.owner ?? "",
            mint: entry.mint,
            delta: BigInt(-(entry.uiTokenAmount?.amount ?? "0")),
          });
        }
        for (const entry of post) {
          const key = `${entry.mint}:${entry.owner}`;
          const prev = mintDeltas.get(key);
          const amount = BigInt(entry.uiTokenAmount?.amount ?? "0");
          if (prev) prev.delta += amount;
          else mintDeltas.set(key, { owner: entry.owner ?? "", mint: entry.mint, delta: amount });
        }

        for (const [, info] of mintDeltas) {
          if (info.delta === 0n) continue;
          const direction = info.delta > 0n ? "to" : "from";
          await execute(
            `INSERT INTO events (
               chain_family, chain_id, block_number, block_hash, tx_hash, log_index,
               contract_address, event_name, decoded_args_json
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
             ON CONFLICT (chain_family, chain_id, tx_hash, log_index) DO NOTHING`,
            [
              chainRef.chainFamily,
              chainRef.chainId,
              slot,
              block.blockhash,
              signature,
              txIndex + 1000,
              info.mint,
              "Transfer",
              JSON.stringify({
                [direction]: info.owner,
                value: info.delta < 0n ? (-info.delta).toString() : info.delta.toString(),
                mint: info.mint,
              }),
            ]
          );
          eventCount += 1;
        }
      }
    }

    await setLastIndexedCursor(chainRef, toSlot);
    log.info({ chainRef, fromSlot, toSlot, events: eventCount }, "indexed Solana slot range");
    fromSlot = toSlot + 1;
  }
}
