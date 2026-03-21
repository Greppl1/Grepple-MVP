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
      expect(record.mintId).to.equal(0);
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
});
