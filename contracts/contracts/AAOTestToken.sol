// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./AgentRegistry.sol";

contract AAOTestToken is ERC20, Ownable, Pausable {
    enum RewardTier { FULL, PARTIAL, NONE }

    struct TokenMintRecord {
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
    mapping(bytes32 => bool) public mintedTaskHashes;

    uint256 public nextMintId;
    uint256 public rewardAmount;

    /// @notice Optional AgentRegistry reference for on-chain registration checks
    AgentRegistry public agentRegistry;

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
    event AgentRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender], "Not authorized minter");
        _;
    }

    constructor(uint256 _rewardAmount) ERC20("AAO Test Token", "AAOT") Ownable(msg.sender) {
        rewardAmount = _rewardAmount;
    }

    // ───────────────────── Admin ─────────────────────

    function setRewardAmount(uint256 _rewardAmount) external onlyOwner {
        uint256 old = rewardAmount;
        rewardAmount = _rewardAmount;
        emit RewardAmountUpdated(old, _rewardAmount);
    }

    function setAgentRegistry(address _registry) external onlyOwner {
        address old = address(agentRegistry);
        agentRegistry = AgentRegistry(_registry);
        emit AgentRegistryUpdated(old, _registry);
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

    // ───────────────────── Minting ─────────────────────

    function mint(
        address agent,
        uint256 amount,
        bytes32 taskHash,
        bytes32 callRecordHash,
        RewardTier tier
    ) external onlyAuthorizedMinter whenNotPaused returns (uint256 mintId) {
        require(agent != address(0), "Zero agent address");
        require(amount > 0, "Zero amount");
        require(!mintedTaskHashes[taskHash], "Task already minted");

        // Enforce agent registration if registry is set
        if (address(agentRegistry) != address(0)) {
            require(agentRegistry.isRegisteredAgent(agent), "Agent not registered");
        }

        mintedTaskHashes[taskHash] = true;

        mintId = nextMintId++;
        mintRecords[mintId] = TokenMintRecord({
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

    // ───────────────────── Queries ─────────────────────

    function isTaskMinted(bytes32 taskHash) external view returns (bool) {
        return mintedTaskHashes[taskHash];
    }

    function getMintRecord(uint256 mintId) external view returns (TokenMintRecord memory) {
        require(mintId < nextMintId, "Mint record does not exist");
        return mintRecords[mintId];
    }

    function getMintsByAgent(address agent) external view returns (uint256[] memory) {
        return _agentMintIds[agent];
    }

    /// @notice Get paginated mint IDs for an agent (prevents OOG on large arrays)
    function getMintsByAgentPaginated(address agent, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256[] storage ids = _agentMintIds[agent];
        if (offset >= ids.length) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > ids.length) end = ids.length;
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = ids[i];
        }
        return result;
    }

    function getAgentMintCount(address agent) external view returns (uint256) {
        return _agentMintIds[agent].length;
    }

    // ───────────────────── Pausable ─────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Freeze ALL token movements (mint, transfer, burn) when paused
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
