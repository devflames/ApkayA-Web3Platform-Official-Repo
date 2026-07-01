import { query } from "../db/index.js";
import { normalizeAddress } from "./events.js";

export interface IndexedEventRow {
  id: string;
  chain_id: number;
  block_number: string;
  block_hash: string;
  tx_hash: string;
  log_index: number;
  contract_address: string;
  event_name: string;
  decoded_args_json: Record<string, unknown>;
  indexed_at: string;
}

export interface TokenBalanceRow {
  contract_address: string;
  balance: string;
}

export interface NftOwnedRow {
  contract_address: string;
  token_id: string;
  balance: string;
  standard: "erc721" | "erc1155";
}

function parseLimit(raw: string | undefined, fallback = 100): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 500);
}

export async function getTokenBalances(
  chainId: number,
  address: string
): Promise<TokenBalanceRow[]> {
  const addr = normalizeAddress(address);
  return query<TokenBalanceRow>(
    `WITH deltas AS (
       SELECT
         contract_address,
         CASE
           WHEN decoded_args_json->>'to' = $2 THEN (decoded_args_json->>'value')::numeric
           WHEN decoded_args_json->>'from' = $2 THEN -(decoded_args_json->>'value')::numeric
           ELSE 0
         END AS delta
       FROM events
       WHERE chain_id = $1
         AND event_name = 'Transfer'
         AND decoded_args_json ? 'value'
         AND (decoded_args_json->>'to' = $2 OR decoded_args_json->>'from' = $2)
     )
     SELECT contract_address, SUM(delta)::text AS balance
     FROM deltas
     GROUP BY contract_address
     HAVING SUM(delta) > 0
     ORDER BY contract_address`,
    [chainId, addr]
  );
}

export async function getNftsOwned(
  chainId: number,
  address: string,
  contractAddress?: string
): Promise<NftOwnedRow[]> {
  const addr = normalizeAddress(address);
  const contractFilter = contractAddress ? normalizeAddress(contractAddress) : null;

  const erc721 = await query<NftOwnedRow>(
    `SELECT contract_address, decoded_args_json->>'tokenId' AS token_id, '1' AS balance, 'erc721' AS standard
     FROM (
       SELECT DISTINCT ON (contract_address, decoded_args_json->>'tokenId')
         contract_address, decoded_args_json, block_number, log_index
       FROM events
       WHERE chain_id = $1
         AND event_name = 'Transfer'
         AND decoded_args_json ? 'tokenId'
         AND NOT decoded_args_json ? 'value'
         AND ($3::text IS NULL OR contract_address = $3)
       ORDER BY contract_address, decoded_args_json->>'tokenId', block_number DESC, log_index DESC
     ) latest
     WHERE decoded_args_json->>'to' = $2
     ORDER BY contract_address, token_id`,
    [chainId, addr, contractFilter]
  );

  const erc1155Single = await query<{ contract_address: string; token_id: string; delta: string }>(
    `SELECT contract_address, decoded_args_json->>'id' AS token_id,
            SUM(
              CASE
                WHEN decoded_args_json->>'to' = $2 THEN (decoded_args_json->>'value')::numeric
                WHEN decoded_args_json->>'from' = $2 THEN -(decoded_args_json->>'value')::numeric
                ELSE 0
              END
            )::text AS delta
     FROM events
     WHERE chain_id = $1
       AND event_name = 'TransferSingle'
       AND ($3::text IS NULL OR contract_address = $3)
       AND (decoded_args_json->>'to' = $2 OR decoded_args_json->>'from' = $2)
     GROUP BY contract_address, decoded_args_json->>'id'
     HAVING SUM(
       CASE
         WHEN decoded_args_json->>'to' = $2 THEN (decoded_args_json->>'value')::numeric
         WHEN decoded_args_json->>'from' = $2 THEN -(decoded_args_json->>'value')::numeric
         ELSE 0
       END
     ) > 0`,
    [chainId, addr, contractFilter]
  );

  const batchRows = await query<IndexedEventRow>(
    `SELECT contract_address, decoded_args_json
     FROM events
     WHERE chain_id = $1
       AND event_name = 'TransferBatch'
       AND ($3::text IS NULL OR contract_address = $3)
       AND (decoded_args_json->>'to' = $2 OR decoded_args_json->>'from' = $2)`,
    [chainId, addr, contractFilter]
  );

  const erc1155BatchMap = new Map<string, bigint>();
  for (const row of batchRows) {
    const args = row.decoded_args_json;
    const from = String(args.from ?? "");
    const to = String(args.to ?? "");
    const ids = (args.ids as string[]) ?? [];
    const values = (args.values as string[]) ?? [];
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!;
      const amount = BigInt(values[i] ?? "0");
      const key = `${row.contract_address}:${id}`;
      let current = erc1155BatchMap.get(key) ?? 0n;
      if (to === addr) current += amount;
      if (from === addr) current -= amount;
      if (current <= 0n) erc1155BatchMap.delete(key);
      else erc1155BatchMap.set(key, current);
    }
  }

  const erc1155: NftOwnedRow[] = erc1155Single.map((row) => ({
    contract_address: row.contract_address,
    token_id: row.token_id,
    balance: row.delta,
    standard: "erc1155" as const,
  }));

  for (const [key, balance] of erc1155BatchMap) {
    const [contract_address, token_id] = key.split(":");
    const existing = erc1155.find(
      (row) => row.contract_address === contract_address && row.token_id === token_id
    );
    if (existing) {
      existing.balance = (BigInt(existing.balance) + balance).toString();
    } else {
      erc1155.push({
        contract_address: contract_address!,
        token_id: token_id!,
        balance: balance.toString(),
        standard: "erc1155",
      });
    }
  }

  return [...erc721, ...erc1155.filter((row) => BigInt(row.balance) > 0n)];
}

export async function listTransfers(filters: {
  chainId: number;
  contractAddress?: string;
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
}): Promise<IndexedEventRow[]> {
  const params: unknown[] = [filters.chainId];
  let sql = `
    SELECT id::text, chain_id, block_number::text, block_hash, tx_hash, log_index,
           contract_address, event_name, decoded_args_json, indexed_at::text
    FROM events
    WHERE chain_id = $1
      AND event_name IN ('Transfer', 'TransferSingle', 'TransferBatch')`;

  if (filters.contractAddress) {
    params.push(normalizeAddress(filters.contractAddress));
    sql += ` AND contract_address = $${params.length}`;
  }
  if (filters.fromBlock !== undefined) {
    params.push(filters.fromBlock);
    sql += ` AND block_number >= $${params.length}`;
  }
  if (filters.toBlock !== undefined) {
    params.push(filters.toBlock);
    sql += ` AND block_number <= $${params.length}`;
  }

  params.push(parseLimit(String(filters.limit)));
  sql += ` ORDER BY block_number DESC, log_index DESC LIMIT $${params.length}`;

  return query<IndexedEventRow>(sql, params);
}

export async function listEvents(filters: {
  chainId: number;
  contractAddress?: string;
  eventName?: string;
  limit?: number;
}): Promise<IndexedEventRow[]> {
  const params: unknown[] = [filters.chainId];
  let sql = `
    SELECT id::text, chain_id, block_number::text, block_hash, tx_hash, log_index,
           contract_address, event_name, decoded_args_json, indexed_at::text
    FROM events
    WHERE chain_id = $1`;

  if (filters.contractAddress) {
    params.push(normalizeAddress(filters.contractAddress));
    sql += ` AND contract_address = $${params.length}`;
  }
  if (filters.eventName) {
    params.push(filters.eventName);
    sql += ` AND event_name = $${params.length}`;
  }

  params.push(parseLimit(String(filters.limit)));
  sql += ` ORDER BY block_number DESC, log_index DESC LIMIT $${params.length}`;

  return query<IndexedEventRow>(sql, params);
}

export async function getIndexerStatus(): Promise<
  Array<{ chain_id: number; last_indexed_block: string; updated_at: string | null }>
> {
  return query(
    `SELECT chain_id, last_indexed_block::text, updated_at::text
     FROM indexer_state
     ORDER BY chain_id`
  );
}
