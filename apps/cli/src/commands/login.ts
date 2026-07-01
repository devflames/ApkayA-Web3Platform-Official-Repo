import prompts from "prompts";
import { saveConfig } from "../config.js";
import { ApkayaClient } from "@apkaya/sdk";

export async function loginCommand(): Promise<void> {
  const answers = await prompts([
    {
      type: "text",
      name: "engineUrl",
      message: "Engine base URL",
      initial: "http://localhost:3005",
    },
    {
      type: "password",
      name: "apiKey",
      message: "Engine API key (one of your ENGINE_ACCESS_KEYS values)",
    },
  ]);

  if (!answers.engineUrl || !answers.apiKey) {
    console.log("Login cancelled.");
    return;
  }

  const client = new ApkayaClient({ baseUrl: answers.engineUrl, apiKey: answers.apiKey });

  try {
    await client.chains.list();
  } catch (err) {
    console.error(
      `⚠ Could not reach Engine at ${answers.engineUrl}: ${err instanceof Error ? err.message : err}`
    );
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: "Save these credentials anyway?",
      initial: false,
    });
    if (!proceed) {
      console.log("Login cancelled.");
      return;
    }
  }

  saveConfig({ engineUrl: answers.engineUrl, apiKey: answers.apiKey });
  console.log(`Saved. Credentials stored in ~/.apkaya/config.json`);
}
