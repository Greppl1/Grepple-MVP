// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract AgentRegistry is Ownable, Pausable {
    struct AgentProfile {
        address wallet;
        address operator;
        bytes32 agentIdHash;
        uint256 registeredAt;
        bool isActive;
        uint256 totalEarned;
        uint256 taskCount;
    }

    mapping(address => AgentProfile) public agents;
    mapping(bytes32 => address) public agentIdToWallet;

    event AgentRegistered(address indexed wallet, bytes32 indexed agentIdHash);
    event AgentDeactivated(address indexed wallet);
    event AgentReactivated(address indexed wallet);
    event AgentStatsUpdated(address indexed wallet, uint256 totalEarned, uint256 taskCount);

    constructor() Ownable(msg.sender) {}

    /// @notice Self-register (caller is the agent wallet)
    function registerAgent(bytes32 agentIdHash) external whenNotPaused {
        require(agents[msg.sender].wallet == address(0), "Already registered");
        require(agentIdToWallet[agentIdHash] == address(0), "AgentId already taken");

        agents[msg.sender] = AgentProfile({
            wallet: msg.sender,
            operator: msg.sender,
            agentIdHash: agentIdHash,
            registeredAt: block.timestamp,
            isActive: true,
            totalEarned: 0,
            taskCount: 0
        });
        agentIdToWallet[agentIdHash] = msg.sender;

        emit AgentRegistered(msg.sender, agentIdHash);
    }

    /// @notice Register on behalf of agent (operator/backend pattern)
    function registerAgentFor(address wallet, bytes32 agentIdHash) external onlyOwner whenNotPaused {
        require(wallet != address(0), "Zero address");
        require(agents[wallet].wallet == address(0), "Already registered");
        require(agentIdToWallet[agentIdHash] == address(0), "AgentId already taken");

        agents[wallet] = AgentProfile({
            wallet: wallet,
            operator: msg.sender,
            agentIdHash: agentIdHash,
            registeredAt: block.timestamp,
            isActive: true,
            totalEarned: 0,
            taskCount: 0
        });
        agentIdToWallet[agentIdHash] = wallet;

        emit AgentRegistered(wallet, agentIdHash);
    }

    function deactivateAgent(address wallet) external onlyOwner {
        require(agents[wallet].wallet != address(0), "Agent not found");
        agents[wallet].isActive = false;
        emit AgentDeactivated(wallet);
    }

    function reactivateAgent(address wallet) external onlyOwner {
        require(agents[wallet].wallet != address(0), "Agent not found");
        require(!agents[wallet].isActive, "Agent already active");
        agents[wallet].isActive = true;
        emit AgentReactivated(wallet);
    }

    function getAgentProfile(address wallet) external view returns (AgentProfile memory) {
        return agents[wallet];
    }

    function isRegisteredAgent(address wallet) external view returns (bool) {
        return agents[wallet].wallet != address(0) && agents[wallet].isActive;
    }

    function updateAgentStats(address wallet, uint256 earned, uint256 tasks) external onlyOwner {
        require(agents[wallet].wallet != address(0), "Agent not found");
        agents[wallet].totalEarned += earned;
        agents[wallet].taskCount += tasks;
        emit AgentStatsUpdated(wallet, agents[wallet].totalEarned, agents[wallet].taskCount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
