import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

interface RegisterPayload {
  chainId: number;
  address: string;
  name: string;
  abi: unknown[];
}

function loadArtifact(contractFile: string, contractName: string): { abi: unknown[] } {
  const artifactPath = path.join(
    process.cwd(),
    "artifacts",
    "contracts",
    contractFile,
    `${contractName}.json`
  );
  const raw = JSON.parse(fs.readFileSync(artifactPath, "utf-8")) as { abi: unknown[] };
  return { abi: raw.abi };
}

async function registerWithEngine(payload: RegisterPayload): Promise<void> {
  const baseUrl = process.env.ENGINE_URL;
  const apiKey = process.env.ENGINE_API_KEY;
  if (!baseUrl || !apiKey) {
    console.warn("ENGINE_URL / ENGINE_API_KEY not set — skipping /contract/register");
    return;
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/contract/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Engine register failed (${res.status})`);
  }

  const body = (await res.json()) as { result: { id: string } };
  console.log(`Registered ${payload.name} with Engine (contract id: ${body.result.id})`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("Deploying ApkayaToken with:", deployer.address, "on chain", chainId);

  const tokenArtifact = loadArtifact("ApkayaToken.sol", "ApkayaToken");
  const Token = await ethers.getContractFactory("ApkayaToken");
  const token = await Token.deploy(
    "ApkayA Demo Token",
    "DEMO",
    ethers.parseEther("1000000"),
    deployer.address
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("ApkayaToken deployed to:", tokenAddress);

  await registerWithEngine({
    chainId,
    address: tokenAddress,
    name: "ApkayaToken",
    abi: tokenArtifact.abi,
  });

  console.log("\nNext: fund an Engine backend wallet with testnet MATIC, then transfer DEMO:");
  console.log(`  TOKEN=${tokenAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
