import type { ChainFamily, ChainRef } from "../services/chainRef.js";

export interface CreateWalletKeyMaterial {
  address: string;
  encryptedKey: string;
  keyType: string;
  chainFamily: ChainFamily;
}

export interface FeeEstimate {
  feeAmount: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFee?: string;
}

export interface SendResult {
  txHash: string;
  nonce?: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFee?: string;
}

export interface ConfirmResult {
  status: "mined" | "reverted" | "pending";
  cursor?: number;
}

export interface PendingTransfer {
  chainRef: ChainRef;
  fromWalletId: string;
  toAddress: string;
  data: string;
  valueAmount: string;
  extraMetadata?: Record<string, unknown>;
}

export interface ChainAdapter {
  readonly chainFamily: ChainFamily;

  generateWalletKeyMaterial(): Promise<CreateWalletKeyMaterial>;

  getBalance(address: string, chainRef: ChainRef): Promise<string>;

  estimateFee(pending: PendingTransfer): Promise<FeeEstimate>;

  signAndSend(pending: PendingTransfer): Promise<SendResult>;

  confirmTx(txHash: string, chainRef: ChainRef): Promise<ConfirmResult>;

  /** Called when send fails so EVM can release a reserved nonce. */
  onSendFailure?(chainRef: ChainRef, walletId: string): Promise<void>;
}
