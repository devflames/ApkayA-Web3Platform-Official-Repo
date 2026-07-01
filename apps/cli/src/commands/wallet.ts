import { ApkayaClient } from "@apkaya/sdk";
import { requireConfig } from "../config.js";

function client(): ApkayaClient {
  const config = requireConfig();
  return new ApkayaClient({ baseUrl: config.engineUrl, apiKey: config.apiKey });
}

export async function walletCreateCommand(label: string): Promise<void> {
  const wallet = await client().wallets.create(label);
  console.log(`Created wallet "${wallet.label}"`);
  console.log(`  id:      ${wallet.id}`);
  console.log(`  address: ${wallet.address}`);
}

export async function walletListCommand(): Promise<void> {
  const wallets = await client().wallets.list();
  if (wallets.length === 0) {
    console.log("No backend wallets yet. Create one with `apkaya wallet create <label>`.");
    return;
  }
  for (const w of wallets) {
    console.log(`${w.label.padEnd(24)} ${w.address}  (${w.id})`);
  }
}

export async function walletBalanceCommand(id: string, chainId: string): Promise<void> {
  const result = await client().wallets.balance(id, Number(chainId));
  console.log(`${result.address} on chain ${result.chainId}: ${result.balanceWei} wei`);
}
