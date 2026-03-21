const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const network = hre.network.name;
  const isTestnet = network === "bscTestnet" || network === "baseSepolia";

  // 1. Deploy MockUSDC (testnet only) or use existing USDC address
  let usdcAddress;
  if (isTestnet) {
    // For testnet, deploy MockUSDC
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log("MockUSDC deployed:", usdcAddress);
  } else {
    // Hardhat local — deploy MockUSDC too
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log("MockUSDC deployed (local):", usdcAddress);
  }

  // 2. Deploy AAOTestToken (rewardAmount = 1 token)
  const rewardAmount = hre.ethers.parseEther("1");
  const Token = await hre.ethers.getContractFactory("AAOTestToken");
  const token = await Token.deploy(rewardAmount);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("AAOTestToken deployed:", tokenAddress);

  // 3. Deploy AgentRegistry
  const Registry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AgentRegistry deployed:", registryAddress);

  // 4. Deploy AAOVault
  const Vault = await hre.ethers.getContractFactory("AAOVault");
  const vault = await Vault.deploy(usdcAddress, tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("AAOVault deployed:", vaultAddress);

  console.log("\n--- Deployment Summary ---");
  console.log(`Network: ${network}`);
  console.log(`MockUSDC: ${usdcAddress}`);
  console.log(`AAOTestToken: ${tokenAddress}`);
  console.log(`AgentRegistry: ${registryAddress}`);
  console.log(`AAOVault: ${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
