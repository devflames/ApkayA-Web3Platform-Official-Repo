#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { createCommand } from "./commands/create.js";
import { deployCommand } from "./commands/deploy.js";
import { walletCreateCommand, walletListCommand, walletBalanceCommand } from "./commands/wallet.js";
import { txSendCommand, txStatusCommand, txListCommand } from "./commands/tx.js";
import {
  apiKeyCreateCommand,
  apiKeyListCommand,
  apiKeyRevokeCommand,
  apiKeyReactivateCommand,
} from "./commands/apikey.js";

const program = new Command();

program
  .name("apkaya")
  .description("CLI for ApkayA Web3Platform — scaffold, deploy, and manage apps on your Engine instance")
  .version("0.1.0");

program
  .command("login")
  .description("Connect the CLI to your Engine instance")
  .action(loginCommand);

program
  .command("create [name]")
  .description("Scaffold a new contract or frontend project")
  .action(createCommand);

program
  .command("deploy")
  .description("Deploy a compiled contract from the current directory")
  .action(deployCommand);

const wallet = program.command("wallet").description("Manage Engine backend wallets");

wallet
  .command("create <label>")
  .description("Create a new backend wallet")
  .action(walletCreateCommand);

wallet
  .command("list")
  .description("List all backend wallets")
  .action(walletListCommand);

wallet
  .command("balance <id> <chainId>")
  .description("Get a backend wallet's native token balance on a chain")
  .action(walletBalanceCommand);

const tx = program.command("tx").description("Queue and inspect transactions via Engine");

tx.command("send")
  .description("Queue a transaction")
  .requiredOption("--chain-id <chainId>", "Chain ID to send on")
  .requiredOption("--from <walletId>", "Backend wallet ID to send from")
  .requiredOption("--to <address>", "Recipient / contract address")
  .option("--data <data>", "Calldata (0x-prefixed hex)", "0x")
  .option("--value <wei>", "Amount of native token to send, in wei", "0")
  .action((opts) => txSendCommand({ chainId: opts.chainId, from: opts.from, to: opts.to, data: opts.data, value: opts.value }));

tx.command("status <id>")
  .description("Check a transaction's status")
  .action(txStatusCommand);

tx.command("list")
  .description("List recent transactions")
  .option("--status <status>", "Filter by status")
  .action((opts) => txListCommand(opts.status));

const apikey = program
  .command("apikey")
  .description("Issue and manage customer API keys (requires the Engine admin key — see `apkaya login`)");

apikey
  .command("create <label>")
  .description("Issue a new API key. The raw key is shown once — store it immediately.")
  .action(apiKeyCreateCommand);

apikey
  .command("list")
  .description("List all issued API keys")
  .action(apiKeyListCommand);

apikey
  .command("revoke <id>")
  .description("Revoke an API key immediately")
  .action(apiKeyRevokeCommand);

apikey
  .command("reactivate <id>")
  .description("Reactivate a previously revoked API key")
  .action(apiKeyReactivateCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
