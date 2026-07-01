import { ethers } from "hardhat";

async function main() {
  const tokenAddress = process.env.TOKEN;
  const to = process.env.BACKEND_WALLET;

  if (!tokenAddress || !to) {
    throw new Error("Set TOKEN and BACKEND_WALLET env vars (token + backend wallet address).");
  }

  const [deployer] = await ethers.getSigners();
  const token = await ethers.getContractAt("ApkayaToken", tokenAddress);
  const amount = ethers.parseEther("100");

  console.log(`Minting 100 DEMO to ${to} (owner: ${deployer.address})...`);
  const tx = await token.mintTo(to, amount);
  await tx.wait();
  console.log("Done. Backend wallet can now send ERC20 transfers via Engine.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
