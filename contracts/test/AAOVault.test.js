const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AAOVault", function () {
  let vault, token, usdc, owner, builder, agent1, minter, unauthorized;
  const REWARD = ethers.parseEther("1");
  const DEPOSIT_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, builder, agent1, minter, unauthorized] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // Deploy AAOTestToken
    const Token = await ethers.getContractFactory("AAOTestToken");
    token = await Token.deploy(REWARD);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("AAOVault");
    vault = await Vault.deploy(await usdc.getAddress(), await token.getAddress());

    // Setup: mint USDC to builder, authorize minter
    await usdc.mint(builder.address, DEPOSIT_AMOUNT);
    await usdc.connect(builder).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
    await token.addMinter(minter.address);
  });

  describe("Constructor", function () {
    it("sets correct USDC and token addresses", async function () {
      expect(await vault.usdc()).to.equal(await usdc.getAddress());
      expect(await vault.testToken()).to.equal(await token.getAddress());
    });

    it("redemption disabled by default", async function () {
      expect(await vault.redemptionEnabled()).to.be.false;
    });

    it("rejects zero USDC address", async function () {
      const Vault = await ethers.getContractFactory("AAOVault");
      await expect(
        Vault.deploy(ethers.ZeroAddress, await token.getAddress())
      ).to.be.revertedWith("Zero USDC address");
    });

    it("rejects zero token address", async function () {
      const Vault = await ethers.getContractFactory("AAOVault");
      await expect(
        Vault.deploy(await usdc.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Zero token address");
    });
  });

  describe("Deposit", function () {
    it("builder can deposit USDC", async function () {
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      expect(await vault.getBuilderBalance(builder.address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("vault receives USDC", async function () {
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      expect(await usdc.balanceOf(await vault.getAddress())).to.equal(DEPOSIT_AMOUNT);
    });

    it("emits Deposited event", async function () {
      await expect(vault.connect(builder).deposit(DEPOSIT_AMOUNT))
        .to.emit(vault, "Deposited")
        .withArgs(builder.address, DEPOSIT_AMOUNT);
    });

    it("accumulates deposits", async function () {
      const half = DEPOSIT_AMOUNT / 2n;
      await vault.connect(builder).deposit(half);
      await vault.connect(builder).deposit(half);
      expect(await vault.getBuilderBalance(builder.address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("rejects zero deposit", async function () {
      await expect(
        vault.connect(builder).deposit(0)
      ).to.be.revertedWith("Zero amount");
    });
  });

  describe("Redemption toggle", function () {
    it("owner can enable redemption", async function () {
      await vault.toggleRedemption(true);
      expect(await vault.redemptionEnabled()).to.be.true;
    });

    it("owner can disable redemption", async function () {
      await vault.toggleRedemption(true);
      await vault.toggleRedemption(false);
      expect(await vault.redemptionEnabled()).to.be.false;
    });

    it("emits RedemptionToggled event", async function () {
      await expect(vault.toggleRedemption(true))
        .to.emit(vault, "RedemptionToggled")
        .withArgs(true);
    });

    it("non-owner cannot toggle", async function () {
      await expect(
        vault.connect(unauthorized).toggleRedemption(true)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Redemption", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_001"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_001"));

    beforeEach(async function () {
      // Mint test tokens to agent
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      // Deposit USDC to vault
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      // Agent approves vault to take test tokens
      await token.connect(agent1).approve(await vault.getAddress(), REWARD);
    });

    it("reverts when redemption disabled", async function () {
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        usdcAmount: ethers.parseEther("1"),
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Redemption disabled");
    });

    it("processes valid redemption", async function () {
      await vault.toggleRedemption(true);
      const usdcOut = ethers.parseEther("1");
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        usdcAmount: usdcOut,
      };
      await vault.connect(agent1).requestRedemption(req);
      expect(await usdc.balanceOf(agent1.address)).to.equal(usdcOut);
      expect(await token.balanceOf(agent1.address)).to.equal(0);
    });

    it("rejects if caller is not agent", async function () {
      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        usdcAmount: ethers.parseEther("1"),
      };
      await expect(
        vault.connect(unauthorized).requestRedemption(req)
      ).to.be.revertedWith("Caller must be agent");
    });

    it("rejects if mintId does not belong to agent", async function () {
      // Mint to a different agent
      const taskHash2 = ethers.keccak256(ethers.toUtf8Bytes("task_002"));
      await token.connect(minter).mint(unauthorized.address, REWARD, taskHash2, callRecordHash, 0);

      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [1], // mintId 1 belongs to unauthorized
        usdcAmount: ethers.parseEther("1"),
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Validation failed");
    });

    it("rejects if token amount exceeds minted total", async function () {
      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD * 2n,
        mintIds: [0],
        usdcAmount: ethers.parseEther("1"),
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Validation failed");
    });
  });

  describe("Emergency withdraw", function () {
    beforeEach(async function () {
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
    });

    it("owner can withdraw", async function () {
      const before = await usdc.balanceOf(owner.address);
      await vault.withdraw(DEPOSIT_AMOUNT);
      expect(await usdc.balanceOf(owner.address)).to.equal(before + DEPOSIT_AMOUNT);
    });

    it("non-owner cannot withdraw", async function () {
      await expect(
        vault.connect(unauthorized).withdraw(DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("rejects if insufficient balance", async function () {
      await expect(
        vault.withdraw(DEPOSIT_AMOUNT * 2n)
      ).to.be.revertedWith("Insufficient balance");
    });
  });
});
