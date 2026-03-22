const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AAOTestToken", function () {
  let token, owner, minter, agent1, agent2, unauthorized;
  const REWARD = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, minter, agent1, agent2, unauthorized] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AAOTestToken");
    token = await Factory.deploy(REWARD);
    await token.addMinter(minter.address);
  });

  describe("Minter management", function () {
    it("owner can add minter", async function () {
      expect(await token.authorizedMinters(minter.address)).to.be.true;
    });

    it("owner can remove minter", async function () {
      await token.removeMinter(minter.address);
      expect(await token.authorizedMinters(minter.address)).to.be.false;
    });

    it("non-owner cannot add minter", async function () {
      await expect(
        token.connect(unauthorized).addMinter(unauthorized.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("cannot add zero address as minter", async function () {
      await expect(
        token.addMinter(ethers.ZeroAddress)
      ).to.be.revertedWith("Zero address");
    });
  });

  describe("Minting", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_001"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_001"));

    it("authorized minter can mint FULL tier", async function () {
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      expect(await token.balanceOf(agent1.address)).to.equal(REWARD);
    });

    it("authorized minter can mint PARTIAL tier (50%)", async function () {
      const half = REWARD / 2n;
      await token.connect(minter).mint(agent1.address, half, taskHash, callRecordHash, 1);
      expect(await token.balanceOf(agent1.address)).to.equal(half);
    });

    it("unauthorized address cannot mint", async function () {
      await expect(
        token.connect(unauthorized).mint(agent1.address, REWARD, taskHash, callRecordHash, 0)
      ).to.be.revertedWith("Not authorized minter");
    });

    it("cannot mint to zero address", async function () {
      await expect(
        token.connect(minter).mint(ethers.ZeroAddress, REWARD, taskHash, callRecordHash, 0)
      ).to.be.revertedWith("Zero agent address");
    });

    it("cannot mint zero amount", async function () {
      await expect(
        token.connect(minter).mint(agent1.address, 0, taskHash, callRecordHash, 0)
      ).to.be.revertedWith("Zero amount");
    });

    it("emits TokenMinted event", async function () {
      await expect(
        token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0)
      )
        .to.emit(token, "TokenMinted")
        .withArgs(0, agent1.address, REWARD, taskHash, 0);
    });

    it("increments mintId", async function () {
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("task_002"));
      await token.connect(minter).mint(agent1.address, REWARD, hash2, callRecordHash, 0);
      expect(await token.nextMintId()).to.equal(2);
    });
  });

  describe("Mint record queries", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_001"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_001"));

    beforeEach(async function () {
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
    });

    it("getMintRecord returns correct data", async function () {
      const record = await token.getMintRecord(0);
      expect(record.agent).to.equal(agent1.address);
      expect(record.amount).to.equal(REWARD);
      expect(record.taskHash).to.equal(taskHash);
      expect(record.callRecordHash).to.equal(callRecordHash);
      expect(record.tier).to.equal(0); // FULL
    });

    it("getMintRecord reverts for non-existent id", async function () {
      await expect(token.getMintRecord(999)).to.be.revertedWith("Mint record does not exist");
    });

    it("getMintsByAgent returns correct ids", async function () {
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("task_002"));
      await token.connect(minter).mint(agent1.address, REWARD, hash2, callRecordHash, 1);

      const ids = await token.getMintsByAgent(agent1.address);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(0);
      expect(ids[1]).to.equal(1);
    });

    it("getMintsByAgent returns empty for unknown agent", async function () {
      const ids = await token.getMintsByAgent(unauthorized.address);
      expect(ids.length).to.equal(0);
    });
  });

  describe("Reward amount configuration", function () {
    it("owner can update reward amount", async function () {
      const newAmount = ethers.parseEther("2");
      await expect(token.setRewardAmount(newAmount))
        .to.emit(token, "RewardAmountUpdated")
        .withArgs(REWARD, newAmount);
      expect(await token.rewardAmount()).to.equal(newAmount);
    });

    it("non-owner cannot update reward amount", async function () {
      await expect(
        token.connect(unauthorized).setRewardAmount(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pausable", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_pause_001"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_pause_001"));

    it("pause() blocks minting", async function () {
      await token.pause();
      await expect(
        token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("pause() blocks transfers", async function () {
      // Mint first, then pause, then try transfer
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      await token.pause();
      await expect(
        token.connect(agent1).transfer(agent2.address, REWARD)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("unpause() resumes minting", async function () {
      await token.pause();
      await token.unpause();
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      expect(await token.balanceOf(agent1.address)).to.equal(REWARD);
    });

    it("non-owner cannot pause/unpause", async function () {
      await expect(
        token.connect(unauthorized).pause()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
      await expect(
        token.connect(unauthorized).unpause()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("Agent registry check", function () {
    let registry;
    const taskHash1 = ethers.keccak256(ethers.toUtf8Bytes("task_reg_001"));
    const taskHash2 = ethers.keccak256(ethers.toUtf8Bytes("task_reg_002"));
    const taskHash3 = ethers.keccak256(ethers.toUtf8Bytes("task_reg_003"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_reg_001"));
    const agentId1 = ethers.keccak256(ethers.toUtf8Bytes("agent_reg_001"));

    beforeEach(async function () {
      const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
      registry = await RegistryFactory.deploy();
    });

    it("mint fails for unregistered agent when registry is set", async function () {
      await token.setAgentRegistry(await registry.getAddress());
      await expect(
        token.connect(minter).mint(agent1.address, REWARD, taskHash1, callRecordHash, 0)
      ).to.be.revertedWith("Agent not registered");
    });

    it("mint succeeds for registered agent", async function () {
      await token.setAgentRegistry(await registry.getAddress());
      await registry.connect(agent1).registerAgent(agentId1);
      await token.connect(minter).mint(agent1.address, REWARD, taskHash1, callRecordHash, 0);
      expect(await token.balanceOf(agent1.address)).to.equal(REWARD);
    });

    it("mint works without registry set (backward compat)", async function () {
      // No setAgentRegistry call — registry remains address(0)
      await token.connect(minter).mint(agent1.address, REWARD, taskHash1, callRecordHash, 0);
      expect(await token.balanceOf(agent1.address)).to.equal(REWARD);
    });
  });

  describe("Task hash uniqueness", function () {
    const taskHash = ethers.keccak256(ethers.toUtf8Bytes("task_unique_001"));
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_unique_001"));

    it("same taskHash reverts on second mint", async function () {
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      await expect(
        token.connect(minter).mint(agent2.address, REWARD, taskHash, callRecordHash, 0)
      ).to.be.revertedWith("Task already minted");
    });

    it("isTaskMinted returns true after mint", async function () {
      expect(await token.isTaskMinted(taskHash)).to.be.false;
      await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      expect(await token.isTaskMinted(taskHash)).to.be.true;
    });
  });

  describe("Paginated queries", function () {
    const callRecordHash = ethers.keccak256(ethers.toUtf8Bytes("cr_page_001"));

    beforeEach(async function () {
      // Mint 5 tokens to agent1
      for (let i = 0; i < 5; i++) {
        const taskHash = ethers.keccak256(ethers.toUtf8Bytes(`task_page_${i}`));
        await token.connect(minter).mint(agent1.address, REWARD, taskHash, callRecordHash, 0);
      }
    });

    it("getMintsByAgentPaginated returns correct slice", async function () {
      const ids = await token.getMintsByAgentPaginated(agent1.address, 1, 3);
      expect(ids.length).to.equal(3);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
      expect(ids[2]).to.equal(3);
    });

    it("getAgentMintCount returns correct count", async function () {
      expect(await token.getAgentMintCount(agent1.address)).to.equal(5);
      expect(await token.getAgentMintCount(agent2.address)).to.equal(0);
    });

    it("offset beyond length returns empty", async function () {
      const ids = await token.getMintsByAgentPaginated(agent1.address, 100, 10);
      expect(ids.length).to.equal(0);
    });
  });
});
