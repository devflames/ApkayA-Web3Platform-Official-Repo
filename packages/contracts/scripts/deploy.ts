import { ethers } from "hardhat";

/**
 * Example deploy script. In ApkayA Web3Platform, contract deploys are
 * triggered from the dashboard (or CLI) which calls this same logic via
 * a templated bytecode + constructor-args approach, then registers the
 * deployed address with Engine so it can be used as a `toAddress` in
 * /transaction/send calls (e.g. for mintTo, claim, setClaimCondition).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  const Token = await ethers.getContractFactory("ApkayaToken");
  const token = await Token.deploy(
    "ApkayA Token",
    "APKA",
    ethers.parseEther("1000000"),
    deployer.address
  );
  await token.waitForDeployment();
  console.log("ApkayaToken deployed to:", await token.getAddress());

  const Drop = await ethers.getContractFactory("ApkayaNFTDrop");
  const drop = await Drop.deploy(
    "ApkayA NFT Drop",
    "APKA-NFT",
    "ipfs://bafybase/", // replace with your real base URI
    deployer.address
  );
  await drop.waitForDeployment();
  console.log("ApkayaNFTDrop deployed to:", await drop.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
