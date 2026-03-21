const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let provider = null;
let signer = null;
let tokenContract = null;
let vaultContract = null;
let registryContract = null;

function loadAbi(contractName, solFileName) {
  const artifactPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'contracts',
    'artifacts',
    'contracts',
    `${solFileName}.sol`,
    `${contractName}.json`
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  return artifact.abi;
}

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return provider;
}

function getSigner() {
  if (!signer) {
    signer = new ethers.Wallet(config.privateKey, getProvider());
  }
  return signer;
}

function getTokenContract() {
  if (!tokenContract) {
    const abi = loadAbi('AAOTestToken', 'AAOTestToken');
    tokenContract = new ethers.Contract(config.contracts.tokenAddress, abi, getSigner());
  }
  return tokenContract;
}

function getVaultContract() {
  if (!vaultContract) {
    const abi = loadAbi('AAOVault', 'AAOVault');
    vaultContract = new ethers.Contract(config.contracts.vaultAddress, abi, getSigner());
  }
  return vaultContract;
}

function getRegistryContract() {
  if (!registryContract) {
    const abi = loadAbi('AgentRegistry', 'AgentRegistry');
    registryContract = new ethers.Contract(config.contracts.registryAddress, abi, getSigner());
  }
  return registryContract;
}

// Allow injecting mock contracts for testing
function setContracts({ token, vault, registry }) {
  if (token) tokenContract = token;
  if (vault) vaultContract = vault;
  if (registry) registryContract = registry;
}

function resetContracts() {
  tokenContract = null;
  vaultContract = null;
  registryContract = null;
  provider = null;
  signer = null;
}

module.exports = {
  getProvider,
  getSigner,
  getTokenContract,
  getVaultContract,
  getRegistryContract,
  setContracts,
  resetContracts,
};
