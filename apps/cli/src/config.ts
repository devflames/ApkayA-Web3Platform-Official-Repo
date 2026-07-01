import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CliConfig {
  engineUrl: string;
  apiKey: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".apkaya");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export function loadConfig(): CliConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: CliConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function requireConfig(): CliConfig {
  const envUrl = process.env.ENGINE_URL;
  const envKey = process.env.ENGINE_API_KEY;
  if (envUrl && envKey) {
    return { engineUrl: envUrl, apiKey: envKey };
  }

  const config = loadConfig();
  if (!config) {
    console.error(
      "Not logged in to an Engine instance. Run `apkaya login` first (or set " +
        "ENGINE_URL / ENGINE_API_KEY env vars)."
    );
    process.exit(1);
  }
  return config;
}
