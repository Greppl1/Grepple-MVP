const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const network = hre.network.name;

  // 1. Deploy MockUSDC (testnet/local — production would use real USDC address)
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed:", usdcAddress);

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

  // 5. Post-deploy: link AgentRegistry to Token for on-chain registration checks
  console.log("\nLinking AgentRegistry to AAOTestToken...");
  await token.setAgentRegistry(registryAddress);
  console.log("AgentRegistry linked.");

  // 6. Post-deploy: authorize deployer as minter (backend will use this key)
  console.log("Adding deployer as authorized minter...");
  await token.addMinter(deployer.address);
  console.log("Deployer authorized as minter.");

  // ───────────────────── Summary ─────────────────────

  console.log("\n--- Deployment Summary ---");
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`MockUSDC: ${usdcAddress}`);
  console.log(`AAOTestToken: ${tokenAddress}`);
  console.log(`AgentRegistry: ${registryAddress}`);
  console.log(`AAOVault: ${vaultAddress}`);

  // ───────────────────── Save addresses to JSON ─────────────────────

  const addresses = {
    network,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockUSDC: usdcAddress,
      AAOTestToken: tokenAddress,
      AgentRegistry: registryAddress,
      AAOVault: vaultAddress,
    },
  };

  const outDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses saved to: ${outFile}`);

  // ───────────────────── Generate .env snippet ─────────────────────

  console.log("\n--- Copy to backend/.env ---");
  console.log(`TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`VAULT_ADDRESS=${vaultAddress}`);
  console.log(`REGISTRY_ADDRESS=${registryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
