import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { ethers } from "ethers";

interface ArtifactFile {
  contractName: string;
  abi: unknown[];
  bytecode: string;
  fullPath: string;
}

interface AbiInput {
  name: string;
  type: string;
}

function findArtifacts(dir: string): ArtifactFile[] {
  const results: ArtifactFile[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findArtifacts(full));
    } else if (entry.name.endsWith(".json") && !entry.name.endsWith(".dbg.json")) {
      try {
        const parsed = JSON.parse(fs.readFileSync(full, "utf-8"));
        if (parsed.bytecode && parsed.abi) {
          results.push({ contractName: parsed.contractName, abi: parsed.abi, bytecode: parsed.bytecode, fullPath: full });
        }
      } catch {
        // not a valid artifact JSON — skip
      }
    }
  }
  return results;
}

/** Coerces a raw CLI-prompted string into the right JS type for an ABI input's Solidity type. */
function coerceArg(raw: string, type: string): unknown {
  if (type.startsWith("uint") || type.startsWith("int")) return BigInt(raw);
  if (type === "bool") return raw.toLowerCase() === "true";
  if (type.endsWith("[]")) return JSON.parse(raw); // expects a JSON array string, e.g. [1,2,3]
  return raw; // address, string, bytes — pass through
}

export async function deployCommand(): Promise<void> {
  const artifactsDir = path.resolve(process.cwd(), "artifacts", "contracts");
  const artifacts = findArtifacts(artifactsDir);

  if (artifacts.length === 0) {
    console.error(
      `No compiled contracts found in ${artifactsDir}. Run "npm run compile" (hardhat compile) first.`
    );
    process.exit(1);
  }

  const { artifactPath } = await prompts({
    type: "select",
    name: "artifactPath",
    message: "Which contract do you want to deploy?",
    choices: artifacts.map((a) => ({ title: a.contractName, value: a.fullPath })),
  });

  const artifact = artifacts.find((a) => a.fullPath === artifactPath);
  if (!artifact) {
    console.log("Cancelled.");
    return;
  }

  const constructorAbi = (artifact.abi as Array<{ type: string; inputs?: AbiInput[] }>).find(
    (item) => item.type === "constructor"
  );
  const inputs = constructorAbi?.inputs ?? [];

  const constructorArgs: unknown[] = [];
  for (const input of inputs) {
    const { value } = await prompts({
      type: "text",
      name: "value",
      message: `Constructor arg "${input.name}" (${input.type})`,
    });
    constructorArgs.push(coerceArg(value ?? "", input.type));
  }

  const { rpcUrl, privateKey } = await prompts([
    {
      type: "text",
      name: "rpcUrl",
      message: "RPC URL to deploy to",
      initial: process.env.DEPLOYER_RPC_URL ?? "https://rpc-amoy.polygon.technology",
    },
    {
      type: "password",
      name: "privateKey",
      message: "Deployer private key (used locally only, never sent anywhere)",
      initial: process.env.DEPLOYER_PRIVATE_KEY,
    },
  ]);

  if (!rpcUrl || !privateKey) {
    console.log("Cancelled.");
    return;
  }

  console.log(`\nDeploying ${artifact.contractName}...`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  const contract = await factory.deploy(...constructorArgs);
  console.log(`Transaction submitted: ${contract.deploymentTransaction()?.hash}`);
  console.log("Waiting for confirmation...");

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n${artifact.contractName} deployed to: ${address}`);
  console.log(
    `\nTip: register this address as a target for your backend wallet's transactions ` +
      `via "apkaya tx send --to ${address} ..." once you've created a backend wallet with "apkaya wallet create".`
  );
}
