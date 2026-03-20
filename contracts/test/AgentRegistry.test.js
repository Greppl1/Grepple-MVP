const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentRegistry", function () {
  let registry, owner, agent1, agent2, unauthorized;
  const agentId1 = ethers.keccak256(ethers.toUtf8Bytes("agent_001"));
  const agentId2 = ethers.keccak256(ethers.toUtf8Bytes("agent_002"));

  beforeEach(async function () {
    [owner, agent1, agent2, unauthorized] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentRegistry");
    registry = await Factory.deploy();
  });

  describe("Registration", function () {
    it("agent can register", async function () {
      await registry.connect(agent1).registerAgent(agentId1);
      expect(await registry.isRegisteredAgent(agent1.address)).to.be.true;
    });

    it("emits AgentRegistered event", async function () {
      await expect(registry.connect(agent1).registerAgent(agentId1))
        .to.emit(registry, "AgentRegistered")
        .withArgs(agent1.address, agentId1);
    });

    it("sets correct profile fields", async function () {
      await registry.connect(agent1).registerAgent(agentId1);
      const profile = await registry.getAgentProfile(agent1.address);
      expect(profile.wallet).to.equal(agent1.address);
      expect(profile.operator).to.equal(agent1.address);
      expect(profile.agentIdHash).to.equal(agentId1);
      expect(profile.isActive).to.be.true;
      expect(profile.totalEarned).to.equal(0);
      expect(profile.taskCount).to.equal(0);
    });

    it("agentIdToWallet reverse lookup works", async function () {
      await registry.connect(agent1).registerAgent(agentId1);
      expect(await registry.agentIdToWallet(agentId1)).to.equal(agent1.address);
    });

    it("cannot register twice", async function () {
      await registry.connect(agent1).registerAgent(agentId1);
      await expect(
        registry.connect(agent1).registerAgent(agentId2)
      ).to.be.revertedWith("Already registered");
    });

    it("cannot reuse agentIdHash", async function () {
      await registry.connect(agent1).registerAgent(agentId1);
      await expect(
        registry.connect(agent2).registerAgent(agentId1)
      ).to.be.revertedWith("AgentId already taken");
    });
  });

  describe("Deactivation", function () {
    beforeEach(async function () {
      await registry.connect(agent1).registerAgent(agentId1);
    });

    it("owner can deactivate agent", async function () {
      await registry.deactivateAgent(agent1.address);
      expect(await registry.isRegisteredAgent(agent1.address)).to.be.false;
    });

    it("emits AgentDeactivated event", async function () {
      await expect(registry.deactivateAgent(agent1.address))
        .to.emit(registry, "AgentDeactivated")
        .withArgs(agent1.address);
    });

    it("non-owner cannot deactivate", async function () {
      await expect(
        registry.connect(unauthorized).deactivateAgent(agent1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("cannot deactivate unregistered agent", async function () {
      await expect(
        registry.deactivateAgent(unauthorized.address)
      ).to.be.revertedWith("Agent not found");
    });
  });

  describe("Queries", function () {
    it("unregistered agent returns default profile", async function () {
      const profile = await registry.getAgentProfile(unauthorized.address);
      expect(profile.wallet).to.equal(ethers.ZeroAddress);
    });

    it("isRegisteredAgent returns false for unregistered", async function () {
      expect(await registry.isRegisteredAgent(unauthorized.address)).to.be.false;
    });
  });

  describe("Stats update", function () {
    beforeEach(async function () {
      await registry.connect(agent1).registerAgent(agentId1);
    });

    it("owner can update stats", async function () {
      await registry.updateAgentStats(agent1.address, ethers.parseEther("1"), 1);
      const profile = await registry.getAgentProfile(agent1.address);
      expect(profile.totalEarned).to.equal(ethers.parseEther("1"));
      expect(profile.taskCount).to.equal(1);
    });

    it("stats accumulate", async function () {
      await registry.updateAgentStats(agent1.address, ethers.parseEther("1"), 1);
      await registry.updateAgentStats(agent1.address, ethers.parseEther("2"), 3);
      const profile = await registry.getAgentProfile(agent1.address);
      expect(profile.totalEarned).to.equal(ethers.parseEther("3"));
      expect(profile.taskCount).to.equal(4);
    });

    it("non-owner cannot update stats", async function () {
      await expect(
        registry.connect(unauthorized).updateAgentStats(agent1.address, 1, 1)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });
});
