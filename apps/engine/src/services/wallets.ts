import { Wallet } from "ethers";
import { nanoid } from "nanoid";
import { execute, query, queryOne } from "../db/index.js";
import { serializeRow, serializeRows } from "../db/serialize.js";
import { getAdapter } from "../adapters/registry.js";
import { decryptSecret } from "./crypto.js";
import { getProvider } from "./chains.js";
import type { ChainFamily } from "./chainRef.js";

export interface BackendWallet {
  id: string;
  label: string;
  address: string;
  key_type: string;
  chain_family: ChainFamily;
  created_at: string;
  is_active: number;
}

const WALLET_COLUMNS =
  "id, label, address, key_type, chain_family, created_at, is_active";

export async function createBackendWallet(
  label: string,
  chainFamily: ChainFamily = "evm"
): Promise<BackendWallet> {
  const adapter = getAdapter(chainFamily);
  const material = await adapter.generateWalletKeyMaterial();
  const id = nanoid();

  await execute(
    `INSERT INTO backend_wallets (id, label, address, encrypted_key, key_type, chain_family)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, label, material.address, material.encryptedKey, material.keyType, material.chainFamily]
  );

  const created = await getBackendWallet(id);
  if (!created) throw new Error("Failed to create backend wallet.");
  return created;
}

export async function getBackendWallet(id: string): Promise<BackendWallet | undefined> {
  const row = await queryOne<BackendWallet>(
    `SELECT ${WALLET_COLUMNS} FROM backend_wallets WHERE id = $1`,
    [id]
  );
  return row ? serializeRow(row) : undefined;
}

export async function listBackendWallets(): Promise<BackendWallet[]> {
  const rows = await query<BackendWallet>(
    `SELECT ${WALLET_COLUMNS} FROM backend_wallets ORDER BY created_at DESC`
  );
  return serializeRows(rows);
}

/** EVM contract/auth paths — requires an EVM backend wallet. */
export async function getSignerForWallet(walletId: string, chainId: number): Promise<Wallet> {
  const row = await queryOne<{ encrypted_key: string; is_active: number; chain_family: string }>(
    `SELECT encrypted_key, is_active, chain_family FROM backend_wallets WHERE id = $1`,
    [walletId]
  );
  if (!row) throw new Error(`Backend wallet ${walletId} not found.`);
  if (!row.is_active) throw new Error(`Backend wallet ${walletId} is deactivated.`);
  if (row.chain_family !== "evm") throw new Error(`Wallet ${walletId} is not an EVM wallet.`);
  return new Wallet(
    decryptSecret(row.encrypted_key),
    getProvider({ chainFamily: "evm", chainId: String(chainId) })
  );
}
