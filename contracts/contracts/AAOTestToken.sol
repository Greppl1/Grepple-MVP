// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AAOTestToken is ERC20, Ownable {
    enum RewardTier { FULL, PARTIAL, NONE }

    struct TokenMintRecord {
        uint256 mintId;
        address agent;
        uint256 amount;
        bytes32 taskHash;
        bytes32 callRecordHash;
        uint256 timestamp;
        RewardTier tier;
    }

    mapping(address => bool) public authorizedMinters;
    mapping(uint256 => TokenMintRecord) public mintRecords;
    mapping(address => uint256[]) private _agentMintIds;

    uint256 public nextMintId;
    uint256 public rewardAmount;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokenMinted(
        uint256 indexed mintId,
        address indexed agent,
        uint256 amount,
        bytes32 taskHash,
        RewardTier tier
    );
    event RewardAmountUpdated(uint256 oldAmount, uint256 newAmount);

    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender], "Not authorized minter");
        _;
    }

    constructor(uint256 _rewardAmount) ERC20("AAO Test Token", "AAOT") Ownable(msg.sender) {
        rewardAmount = _rewardAmount;
    }

    function setRewardAmount(uint256 _rewardAmount) external onlyOwner {
        uint256 old = rewardAmount;
        rewardAmount = _rewardAmount;
        emit RewardAmountUpdated(old, _rewardAmount);
    }

    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Zero address");
        authorizedMinters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRemoved(minter);
    }

    function mint(
        address agent,
        uint256 amount,
        bytes32 taskHash,
        bytes32 callRecordHash,
        RewardTier tier
    ) external onlyAuthorizedMinter returns (uint256 mintId) {
        require(agent != address(0), "Zero agent address");
        require(amount > 0, "Zero amount");

        mintId = nextMintId++;
        mintRecords[mintId] = TokenMintRecord({
            mintId: mintId,
            agent: agent,
            amount: amount,
            taskHash: taskHash,
            callRecordHash: callRecordHash,
            timestamp: block.timestamp,
            tier: tier
        });
        _agentMintIds[agent].push(mintId);

        _mint(agent, amount);

        emit TokenMinted(mintId, agent, amount, taskHash, tier);
    }

    function getMintRecord(uint256 mintId) external view returns (TokenMintRecord memory) {
        require(mintId < nextMintId, "Mint record does not exist");
        return mintRecords[mintId];
    }

    function getMintsByAgent(address agent) external view returns (uint256[] memory) {
        return _agentMintIds[agent];
    }
}
