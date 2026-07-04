import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { queryOne } from "../db/index.js";
import { decryptSecret, encryptSecret } from "../services/crypto.js";
import { getChainConfig, getConnection } from "../services/chains.js";
import type { ChainRef } from "../services/chainRef.js";
import type {
  ChainAdapter,
  ConfirmResult,
  CreateWalletKeyMaterial,
  FeeEstimate,
  PendingTransfer,
  SendResult,
} from "./types.js";

async function loadSolanaKeypair(walletId: string): Promise<Keypair> {
  const row = await queryOne<{
    encrypted_key: string;
    is_active: number;
    chain_family: string;
  }>(`SELECT encrypted_key, is_active, chain_family FROM backend_wallets WHERE id = $1`, [walletId]);
  if (!row) throw new Error(`Backend wallet ${walletId} not found.`);
  if (!row.is_active) throw new Error(`Backend wallet ${walletId} is deactivated.`);
  if (row.chain_family !== "solana") throw new Error(`Wallet ${walletId} is not a Solana wallet.`);
  const bytes = Buffer.from(decryptSecret(row.encrypted_key), "base64");
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

export class SolanaAdapter implements ChainAdapter {
  readonly chainFamily = "solana" as const;

  async generateWalletKeyMaterial(): Promise<CreateWalletKeyMaterial> {
    const keypair = Keypair.generate();
    return {
      address: keypair.publicKey.toBase58(),
      encryptedKey: encryptSecret(Buffer.from(keypair.secretKey).toString("base64")),
      keyType: "solana_local",
      chainFamily: "solana",
    };
  }

  private commitment(chainRef: ChainRef) {
    return getChainConfig(chainRef).commitment ?? "confirmed";
  }

  async getBalance(address: string, chainRef: ChainRef): Promise<string> {
    const lamports = await getConnection(chainRef).getBalance(new PublicKey(address));
    return lamports.toString();
  }

  private async buildTransaction(pending: PendingTransfer, keypair: Keypair): Promise<Transaction> {
    const connection = getConnection(pending.chainRef);
    const commitment = this.commitment(pending.chainRef);
    const { blockhash } = await connection.getLatestBlockhash(commitment);

    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: keypair.publicKey });
    const splMint = pending.extraMetadata?.splMint as string | undefined;
    const splAmount = pending.extraMetadata?.splAmount as string | undefined;

    if (splMint && splAmount) {
      const mint = new PublicKey(splMint);
      const destination = new PublicKey(pending.toAddress);
      const sourceAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
      const destAta = await getAssociatedTokenAddress(mint, destination);
      tx.add(
        createTransferInstruction(
          sourceAta,
          destAta,
          keypair.publicKey,
          BigInt(splAmount),
          [],
          TOKEN_PROGRAM_ID
        )
      );
    } else {
      const lamports = BigInt(pending.valueAmount || "0");
      if (lamports <= 0n) {
        throw new Error("Solana transfer requires lamports or metadata.splMint + metadata.splAmount.");
      }
      tx.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(pending.toAddress),
          lamports: Number(lamports),
        })
      );
    }

    return tx;
  }

  async estimateFee(pending: PendingTransfer): Promise<FeeEstimate> {
    const keypair = await loadSolanaKeypair(pending.fromWalletId);
    const tx = await this.buildTransaction(pending, keypair);
    const connection = getConnection(pending.chainRef);
    const fee = await connection.getFeeForMessage(
      tx.compileMessage(),
      this.commitment(pending.chainRef)
    );
    return { feeAmount: String(fee.value ?? 5000) };
  }

  async signAndSend(pending: PendingTransfer): Promise<SendResult> {
    const keypair = await loadSolanaKeypair(pending.fromWalletId);
    const tx = await this.buildTransaction(pending, keypair);
    tx.sign(keypair);

    const connection = getConnection(pending.chainRef);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: this.commitment(pending.chainRef),
    });

    return { txHash: signature };
  }

  async confirmTx(txHash: string, chainRef: ChainRef): Promise<ConfirmResult> {
    const connection = getConnection(chainRef);
    const result = await connection.getSignatureStatuses([txHash], {
      searchTransactionHistory: true,
    });
    const status = result.value[0];
    if (!status) return { status: "pending" };
    if (status.err) return { status: "reverted", cursor: status.slot ?? undefined };

    const conf = status.confirmationStatus ?? "processed";
    if (conf === "confirmed" || conf === "finalized") {
      return { status: "mined", cursor: status.slot ?? undefined };
    }
    return { status: "pending", cursor: status.slot ?? undefined };
  }
}

export const solanaAdapter = new SolanaAdapter();
