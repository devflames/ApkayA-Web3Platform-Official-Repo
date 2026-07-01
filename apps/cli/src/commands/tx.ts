import { ApkayaClient } from "@apkaya/sdk";
import { requireConfig } from "../config.js";

function client(): ApkayaClient {
  const config = requireConfig();
  return new ApkayaClient({ baseUrl: config.engineUrl, apiKey: config.apiKey });
}

export interface SendTxOptions {
  chainId: string;
  from: string;
  to: string;
  data?: string;
  value?: string;
}

export async function txSendCommand(options: SendTxOptions): Promise<void> {
  const tx = await client().transactions.send({
    chainId: Number(options.chainId),
    fromWalletId: options.from,
    toAddress: options.to,
    data: options.data,
    valueWei: options.value,
  });

  console.log(`Queued transaction ${tx.id} (status: ${tx.status})`);
  console.log(`Check status with: apkaya tx status ${tx.id}`);
}

export async function txStatusCommand(id: string): Promise<void> {
  const tx = await client().transactions.status(id);
  console.log(`id:      ${tx.id}`);
  console.log(`status:  ${tx.status}`);
  console.log(`chain:   ${tx.chain_id}`);
  console.log(`to:      ${tx.to_address}`);
  console.log(`hash:    ${tx.tx_hash ?? "—"}`);
}

export async function txListCommand(status?: string): Promise<void> {
  const txs = await client().transactions.list({ status, limit: 30 });
  if (txs.length === 0) {
    console.log("No transactions found.");
    return;
  }
  for (const tx of txs) {
    console.log(`${tx.id}  ${tx.status.padEnd(10)} chain=${tx.chain_id}  to=${tx.to_address}  hash=${tx.tx_hash ?? "—"}`);
  }
}
