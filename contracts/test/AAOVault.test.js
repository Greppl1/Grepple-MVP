const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AAOVault", function () {
  let vault, token, usdc, registry, owner, builder, agent1, minter, unauthorized;
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

    // Deploy AgentRegistry
    const Registry = await ethers.getContractFactory("AgentRegistry");
    registry = await Registry.deploy();

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
      expect(await vault.getBuilderDeposited(builder.address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("vault receives USDC", async function () {
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      expect(await usdc.balanceOf(await vault.getAddress())).to.equal(DEPOSIT_AMOUNT);
    });

    it("emits Deposited event", async function () {
      await expect(vault.connect(builder).deposit(DEPOSIT_AMOUNT))
        .to.emit(vault, "Deposited")
        .withArgs(builder.address, DEPOSIT_AMOUNT, false);
    });

    it("accumulates deposits", async function () {
      const half = DEPOSIT_AMOUNT / 2n;
      await vault.connect(builder).deposit(half);
      await vault.connect(builder).deposit(half);
      expect(await vault.getBuilderDeposited(builder.address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("rejects zero deposit", async function () {
      await expect(
        vault.connect(builder).deposit(0)
      ).to.be.revertedWith("Zero amount");
    });
  });

  describe("depositFor (operator pattern)", function () {
    it("owner can deposit on behalf of builder", async function () {
      // Give owner some USDC
      const amount = ethers.parseEther("50");
      await usdc.mint(owner.address, amount);
      await usdc.connect(owner).approve(await vault.getAddress(), amount);

      await vault.depositFor(builder.address, amount);
      expect(await vault.getBuilderDeposited(builder.address)).to.equal(amount);
    });

    it("emits Deposited event with isOperator=true", async function () {
      const amount = ethers.parseEther("50");
      await usdc.mint(owner.address, amount);
      await usdc.connect(owner).approve(await vault.getAddress(), amount);

      await expect(vault.depositFor(builder.address, amount))
        .to.emit(vault, "Deposited")
        .withArgs(builder.address, amount, true);
    });

    it("non-owner cannot depositFor", async function () {
      await expect(
        vault.connect(unauthorized).depositFor(builder.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("rejects zero builder address", async function () {
      await expect(
        vault.depositFor(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Zero builder address");
    });
  });

  describe("totalDeposited / totalRedeemed accounting", function () {
    it("tracks totalDeposited across multiple deposits", async function () {
      const half = DEPOSIT_AMOUNT / 2n;
      await vault.connect(builder).deposit(half);
      await vault.connect(builder).deposit(half);
      expect(await vault.totalDeposited()).to.equal(DEPOSIT_AMOUNT);
    });

    it("tracks totalRedeemed after redemption", async function () {
      const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_acct"));
      const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_acct"));
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      await token.connect(agent1).approve(await vault.getAddress(), REWARD);
      await vault.toggleRedemption(true);

      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await vault.connect(agent1).requestRedemption(req);
      expect(await vault.totalRedeemed()).to.equal(REWARD); // 1:1 rate
    });
  });

  describe("getAvailableBalance", function () {
    it("returns USDC balance held by vault", async function () {
      expect(await vault.getAvailableBalance()).to.equal(0);
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      expect(await vault.getAvailableBalance()).to.equal(DEPOSIT_AMOUNT);
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
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Redemption disabled");
    });

    it("processes valid redemption", async function () {
      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await vault.connect(agent1).requestRedemption(req);
      expect(await usdc.balanceOf(agent1.address)).to.equal(REWARD);
      expect(await token.balanceOf(agent1.address)).to.equal(0);
    });

    it("emits RedemptionProcessed event", async function () {
      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await expect(vault.connect(agent1).requestRedemption(req))
        .to.emit(vault, "RedemptionProcessed")
        .withArgs(agent1.address, REWARD, REWARD, [0]);
    });

    it("rejects if caller is not agent", async function () {
      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(unauthorized).requestRedemption(req)
      ).to.be.revertedWith("Caller must be agent");
    });

    it("rejects if mintId does not belong to agent", async function () {
      const taskHash2 = ethers.keccak256(ethers.toUtf8Bytes("task_002"));
      await token.connect(minter).mint(unauthorized.address, REWARD, taskHash2, callRecordHash, 0);

      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [1],
        minUsdcOut: 0,
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
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Validation failed");
    });

    it("rejects if USDC output below minUsdcOut (slippage protection)", async function () {
      await vault.toggleRedemption(true);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: REWARD * 2n, // Impossible, 1:1 rate would give REWARD
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("USDC output below minimum");
    });
  });

  describe("setExchangeRate + redemption at different rates", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_rate"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_rate"));

    beforeEach(async function () {
      // Mint 10 tokens to agent
      const amount = ethers.parseEther("10");
      await token.connect(minter).mint(agent1.address, amount, taskHash, callRecordHash, 0);
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      await token.connect(agent1).approve(await vault.getAddress(), amount);
      await vault.toggleRedemption(true);
    });

    it("default 1:1 rate: 10 tokens → 10 USDC", async function () {
      const req = {
        agent: agent1.address,
        tokenAmount: ethers.parseEther("10"),
        mintIds: [0],
        minUsdcOut: 0,
      };
      await vault.connect(agent1).requestRedemption(req);
      expect(await usdc.balanceOf(agent1.address)).to.equal(ethers.parseEther("10"));
    });

    it("2:1 rate: 10 tokens → 5 USDC", async function () {
      // 2 tokens per 1 USDC
      await vault.setExchangeRate(ethers.parseEther("2"));
      const req = {
        agent: agent1.address,
        tokenAmount: ethers.parseEther("10"),
        mintIds: [0],
        minUsdcOut: 0,
      };
      await vault.connect(agent1).requestRedemption(req);
      expect(await usdc.balanceOf(agent1.address)).to.equal(ethers.parseEther("5"));
    });

    it("emits ExchangeRateUpdated event", async function () {
      const newRate = ethers.parseEther("3");
      await expect(vault.setExchangeRate(newRate))
        .to.emit(vault, "ExchangeRateUpdated")
        .withArgs(ethers.parseEther("1"), newRate);
    });
  });

  describe("Duplicate mintIds in single request", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_dup"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_dup"));

    it("reverts when same mintId appears twice", async function () {
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      await token.connect(agent1).approve(await vault.getAddress(), REWARD);
      await vault.toggleRedemption(true);

      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0, 0], // duplicate
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("MintId already redeemed");
    });
  });

  describe("MAX_MINT_IDS limit", function () {
    it("reverts when more than 50 mintIds", async function () {
      await vault.toggleRedemption(true);
      // Create 51 mint IDs
      const mintIds = Array.from({ length: 51 }, (_, i) => i);
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds,
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Too many mintIds");
    });
  });

  describe("Pausable", function () {
    it("deposit reverts when paused", async function () {
      await vault.pause();
      await expect(
        vault.connect(builder).deposit(DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("depositFor reverts when paused", async function () {
      await vault.pause();
      await expect(
        vault.depositFor(builder.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("redemption reverts when paused", async function () {
      const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_pause"));
      const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_pause"));
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      await token.connect(agent1).approve(await vault.getAddress(), REWARD);
      await vault.toggleRedemption(true);

      await vault.pause();
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("unpausing restores functionality", async function () {
      await vault.pause();
      await vault.unpause();
      // deposit should work again
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      expect(await vault.getBuilderDeposited(builder.address)).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Agent registry check in redemption", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_reg"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_reg"));

    beforeEach(async function () {
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      await token.connect(agent1).approve(await vault.getAddress(), REWARD);
      await vault.toggleRedemption(true);
      // Set registry on vault
      await vault.setAgentRegistry(await registry.getAddress());
    });

    it("registered active agent can redeem", async function () {
      const agentIdHash = ethers.keccak256(ethers.toUtf8Bytes("agent_for_reg"));
      await registry.registerAgentFor(agent1.address, agentIdHash);

      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await vault.connect(agent1).requestRedemption(req);
      expect(await usdc.balanceOf(agent1.address)).to.equal(REWARD);
    });

    it("unregistered agent is blocked", async function () {
      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Agent not registered or inactive");
    });

    it("deactivated agent is blocked", async function () {
      const agentIdHash = ethers.keccak256(ethers.toUtf8Bytes("agent_deact"));
      await registry.registerAgentFor(agent1.address, agentIdHash);
      await registry.deactivateAgent(agent1.address);

      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await expect(
        vault.connect(agent1).requestRedemption(req)
      ).to.be.revertedWith("Agent not registered or inactive");
    });

    it("no registry set means no check (passes)", async function () {
      // Deploy a fresh vault without registry
      const Vault = await ethers.getContractFactory("AAOVault");
      const vault2 = await Vault.deploy(await usdc.getAddress(), await token.getAddress());

      // Setup for vault2
      const amount = ethers.parseEther("50");
      await usdc.mint(builder.address, amount);
      await usdc.connect(builder).approve(await vault2.getAddress(), amount);
      await vault2.connect(builder).deposit(amount);

      const taskHash2 = ethers.keccak256(ethers.toUtf8Bytes("task_noreg"));
      const callRecordHash2 = ethers.keccak256(ethers.toUtf8Bytes("cr_noreg"));
      await token.connect(minter).mint(agent1.address, REWARD, taskHash2, callRecordHash2, 0);
      // agent1 already has mintId 0 from beforeEach, new one is mintId 1
      await token.connect(agent1).approve(await vault2.getAddress(), REWARD);
      await vault2.toggleRedemption(true);

      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [1],
        minUsdcOut: 0,
      };
      await vault2.connect(agent1).requestRedemption(req);
      expect(await usdc.balanceOf(agent1.address)).to.equal(REWARD);
    });
  });

  describe("withdrawTokens", function () {
    it("owner can withdraw accumulated test tokens", async function () {
      const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_wt"));
      const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_wt"));
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      await vault.connect(builder).deposit(DEPOSIT_AMOUNT);
      await token.connect(agent1).approve(await vault.getAddress(), REWARD);
      await vault.toggleRedemption(true);

      const req = {
        agent: agent1.address,
        tokenAmount: REWARD,
        mintIds: [0],
        minUsdcOut: 0,
      };
      await vault.connect(agent1).requestRedemption(req);

      // Vault now holds REWARD tokens
      expect(await token.balanceOf(await vault.getAddress())).to.equal(REWARD);

      const ownerBefore = await token.balanceOf(owner.address);
      await vault.withdrawTokens(REWARD);
      expect(await token.balanceOf(owner.address)).to.equal(ownerBefore + REWARD);
      expect(await token.balanceOf(await vault.getAddress())).to.equal(0);
    });

    it("emits TokensWithdrawn event", async function () {
      // Transfer tokens directly to vault for simplicity
      const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_wte"));
      const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_wte"));
      await token.connect(minter).mint(owner.address, REWARD, taskHash, callRecordHash, 0);
      await token.connect(owner).transfer(await vault.getAddress(), REWARD);

      await expect(vault.withdrawTokens(REWARD))
        .to.emit(vault, "TokensWithdrawn")
        .withArgs(owner.address, REWARD);
    });

    it("non-owner cannot withdrawTokens", async function () {
      await expect(
        vault.connect(unauthorized).withdrawTokens(REWARD)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("reverts if insufficient token balance", async function () {
      await expect(
        vault.withdrawTokens(REWARD)
      ).to.be.revertedWith("Insufficient token balance");
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
