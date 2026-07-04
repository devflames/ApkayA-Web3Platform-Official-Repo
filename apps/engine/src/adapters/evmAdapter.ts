import { Wallet } from "ethers";
import { queryOne } from "../db/index.js";
import { decryptSecret, encryptSecret } from "../services/crypto.js";
import { getProvider } from "../services/chains.js";
import type { ChainRef } from "../services/chainRef.js";
import { NonceManager } from "../services/nonceManager.js";
import type {
  ChainAdapter,
  ConfirmResult,
  CreateWalletKeyMaterial,
  FeeEstimate,
  PendingTransfer,
  SendResult,
} from "./types.js";

const nonceManager = new NonceManager((chainId) =>
  getProvider({ chainFamily: "evm", chainId: String(chainId) })
);

async function loadEvmWalletRow(walletId: string) {
  const row = await queryOne<{
    encrypted_key: string;
    is_active: number;
    chain_family: string;
  }>(`SELECT encrypted_key, is_active, chain_family FROM backend_wallets WHERE id = $1`, [walletId]);
  if (!row) throw new Error(`Backend wallet ${walletId} not found.`);
  if (!row.is_active) throw new Error(`Backend wallet ${walletId} is deactivated.`);
  if (row.chain_family !== "evm") throw new Error(`Wallet ${walletId} is not an EVM wallet.`);
  return row;
}

export class EvmAdapter implements ChainAdapter {
  readonly chainFamily = "evm" as const;

  async generateWalletKeyMaterial(): Promise<CreateWalletKeyMaterial> {
    const wallet = Wallet.createRandom();
    return {
      address: wallet.address,
      encryptedKey: encryptSecret(wallet.privateKey),
      keyType: "local",
      chainFamily: "evm",
    };
  }

  private async getSigner(walletId: string, chainRef: ChainRef): Promise<Wallet> {
    const row = await loadEvmWalletRow(walletId);
    return new Wallet(decryptSecret(row.encrypted_key), getProvider(chainRef));
  }

  async getBalance(address: string, chainRef: ChainRef): Promise<string> {
    return (await getProvider(chainRef).getBalance(address)).toString();
  }

  async estimateFee(pending: PendingTransfer): Promise<FeeEstimate> {
    const signer = await this.getSigner(pending.fromWalletId, pending.chainRef);
    const provider = getProvider(pending.chainRef);
    const [feeData, gasEstimate] = await Promise.all([
      provider.getFeeData(),
      provider
        .estimateGas({
          from: signer.address,
          to: pending.toAddress,
          data: pending.data,
          value: BigInt(pending.valueAmount),
        })
        .catch(() => 100_000n),
    ]);

    const maxPriorityFeePerGas = ((feeData.maxPriorityFeePerGas ?? 1_500_000_000n) * 120n) / 100n;
    const maxFeePerGas = ((feeData.maxFeePerGas ?? 30_000_000_000n) * 120n) / 100n;
    const gasLimit = ((gasEstimate * 120n) / 100n).toString();

    return {
      feeAmount: (BigInt(gasLimit) * maxFeePerGas).toString(),
      gasLimit,
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFee: maxPriorityFeePerGas.toString(),
    };
  }

  async signAndSend(pending: PendingTransfer): Promise<SendResult> {
    const signer = await this.getSigner(pending.fromWalletId, pending.chainRef);
    const provider = getProvider(pending.chainRef);
    const chainNumeric = Number(pending.chainRef.chainId);

    const [feeData, nonce, gasEstimate] = await Promise.all([
      provider.getFeeData(),
      nonceManager.acquireNonce(chainNumeric, signer.address),
      provider
        .estimateGas({
          from: signer.address,
          to: pending.toAddress,
          data: pending.data,
          value: BigInt(pending.valueAmount),
        })
        .catch(() => 100_000n),
    ]);

    const maxPriorityFeePerGas = ((feeData.maxPriorityFeePerGas ?? 1_500_000_000n) * 120n) / 100n;
    const maxFeePerGas = ((feeData.maxFeePerGas ?? 30_000_000_000n) * 120n) / 100n;
    const gasLimit = (gasEstimate * 120n) / 100n;

    const sent = await signer.sendTransaction({
      to: pending.toAddress,
      data: pending.data,
      value: BigInt(pending.valueAmount),
      nonce,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    return {
      txHash: sent.hash,
      nonce,
      gasLimit: gasLimit.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFee: maxPriorityFeePerGas.toString(),
    };
  }

  async confirmTx(txHash: string, chainRef: ChainRef): Promise<ConfirmResult> {
    const receipt = await getProvider(chainRef).waitForTransaction(txHash, 1);
    if (!receipt) return { status: "pending" };
    if (receipt.status === 1) return { status: "mined", cursor: receipt.blockNumber };
    return { status: "reverted", cursor: receipt.blockNumber };
  }

  async onSendFailure(chainRef: ChainRef, walletId: string): Promise<void> {
    const signer = await this.getSigner(walletId, chainRef);
    nonceManager.releaseNonce(Number(chainRef.chainId), signer.address);
    await nonceManager.reconcile(Number(chainRef.chainId), signer.address);
  }
}

export const evmAdapter = new EvmAdapter();
