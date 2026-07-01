import { nanoid } from "nanoid";
import { Wallet } from "ethers";
import { db } from "../db/index.js";
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

/** Creates a brand-new backend wallet (random key, local key_type) and stores it encrypted. */
export function createBackendWallet(label: string): BackendWallet {
  const wallet = Wallet.createRandom();
  const id = nanoid();

  db.prepare(
    `INSERT INTO backend_wallets (id, label, address, encrypted_key, key_type)
     VALUES (?, ?, ?, ?, 'local')`
  ).run(id, label, wallet.address, encryptSecret(wallet.privateKey));

  return getBackendWallet(id)!;
}

export function getBackendWallet(id: string): BackendWallet | undefined {
  return db
    .prepare(`SELECT id, label, address, key_type, created_at, is_active FROM backend_wallets WHERE id = ?`)
    .get(id) as BackendWallet | undefined;
}

export function listBackendWallets(): BackendWallet[] {
  return db
    .prepare(`SELECT id, label, address, key_type, created_at, is_active FROM backend_wallets ORDER BY created_at DESC`)
    .all() as BackendWallet[];
}

/** Loads and decrypts a wallet's private key, returning a chain-connected ethers Signer. */
export function getSignerForWallet(walletId: string, chainId: number): Wallet {
  const row = db
    .prepare(`SELECT encrypted_key, is_active FROM backend_wallets WHERE id = ?`)
    .get(walletId) as { encrypted_key: string; is_active: number } | undefined;

  if (!row) throw new Error(`Backend wallet ${walletId} not found.`);
  if (!row.is_active) throw new Error(`Backend wallet ${walletId} is deactivated.`);

  const privateKey = decryptSecret(row.encrypted_key);
  return new Wallet(privateKey, getProvider(chainId));
}
