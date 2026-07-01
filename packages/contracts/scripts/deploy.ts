import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

interface RegisterPayload {
  chainId: number;
  address: string;
  name: string;
  abi: unknown[];
  deployerWalletId?: string;
  txId?: string;
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

  console.log("Deploying contracts with:", deployer.address, "on chain", chainId);

  const tokenArtifact = loadArtifact("ApkayaToken.sol", "ApkayaToken");
  const Token = await ethers.getContractFactory("ApkayaToken");
  const token = await Token.deploy(
    "ApkayA Token",
    "APKA",
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
    deployerWalletId: process.env.ENGINE_DEPLOYER_WALLET_ID,
  });

  const dropArtifact = loadArtifact("ApkayaNFTDrop.sol", "ApkayaNFTDrop");
  const Drop = await ethers.getContractFactory("ApkayaNFTDrop");
  const drop = await Drop.deploy(
    "ApkayA NFT Drop",
    "APKA-NFT",
    "ipfs://bafybase/",
    deployer.address
  );
  await drop.waitForDeployment();
  const dropAddress = await drop.getAddress();
  console.log("ApkayaNFTDrop deployed to:", dropAddress);

  await registerWithEngine({
    chainId,
    address: dropAddress,
    name: "ApkayaNFTDrop",
    abi: dropArtifact.abi,
    deployerWalletId: process.env.ENGINE_DEPLOYER_WALLET_ID,
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
