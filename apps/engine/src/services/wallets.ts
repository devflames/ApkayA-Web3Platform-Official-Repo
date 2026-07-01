import { nanoid } from "nanoid";
import { Wallet } from "ethers";
import { execute, query, queryOne } from "../db/index.js";
import { serializeRow, serializeRows } from "../db/serialize.js";
import { encryptSecret, decryptSecret } from "./crypto.js";
import { getProvider } from "./chains.js";

export interface BackendWallet {
  id: string;
  label: string;
  address: string;
  key_type: string;
  created_at: string;
  is_active: number;
}

const WALLET_COLUMNS =
  "id, label, address, key_type, created_at, is_active";

/** Creates a brand-new backend wallet (random key, local key_type) and stores it encrypted. */
export async function createBackendWallet(label: string): Promise<BackendWallet> {
  const wallet = Wallet.createRandom();
  const id = nanoid();

  await execute(
    `INSERT INTO backend_wallets (id, label, address, encrypted_key, key_type)
     VALUES ($1, $2, $3, $4, 'local')`,
    [id, label, wallet.address, encryptSecret(wallet.privateKey)]
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

/** Loads and decrypts a wallet's private key, returning a chain-connected ethers Signer. */
export async function getSignerForWallet(walletId: string, chainId: number): Promise<Wallet> {
  const row = await queryOne<{ encrypted_key: string; is_active: number }>(
    `SELECT encrypted_key, is_active FROM backend_wallets WHERE id = $1`,
    [walletId]
  );

  if (!row) throw new Error(`Backend wallet ${walletId} not found.`);
  if (!row.is_active) throw new Error(`Backend wallet ${walletId} is deactivated.`);

  const privateKey = decryptSecret(row.encrypted_key);
  return new Wallet(privateKey, getProvider(chainId));
}
