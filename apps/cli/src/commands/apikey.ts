import { ApkayaClient } from "@apkaya/sdk";
import { requireConfig } from "../config.js";

function client(): ApkayaClient {
  const config = requireConfig();
  return new ApkayaClient({ baseUrl: config.engineUrl, apiKey: config.apiKey });
}

export async function apiKeyCreateCommand(label: string): Promise<void> {
  const created = await client().apiKeys.create(label);
  console.log(`Created API key "${created.label}"`);
  console.log(`  id:  ${created.id}`);
  console.log(`  key: ${created.key}`);
  console.log(`\nStore this key now — Engine only keeps its hash and cannot show it again.`);
}

export async function apiKeyListCommand(): Promise<void> {
  const keys = await client().apiKeys.list();
  if (keys.length === 0) {
    console.log("No API keys yet. Create one with `apkaya apikey create <label>`.");
    return;
  }
  for (const k of keys) {
    const status = k.is_active ? "active" : "revoked";
    console.log(`${k.label.padEnd(24)} ${k.key_prefix}...  ${status.padEnd(8)} (${k.id})`);
  }
}

export async function apiKeyRevokeCommand(id: string): Promise<void> {
  await client().apiKeys.revoke(id);
  console.log(`Revoked key ${id}`);
}

export async function apiKeyReactivateCommand(id: string): Promise<void> {
  await client().apiKeys.reactivate(id);
  console.log(`Reactivated key ${id}`);
}
