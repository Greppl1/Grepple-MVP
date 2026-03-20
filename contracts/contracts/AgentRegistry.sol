// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is Ownable {
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
    event AgentStatsUpdated(address indexed wallet, uint256 totalEarned, uint256 taskCount);

    constructor() Ownable(msg.sender) {}

    function registerAgent(bytes32 agentIdHash) external {
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

    function deactivateAgent(address wallet) external onlyOwner {
        require(agents[wallet].wallet != address(0), "Agent not found");
        agents[wallet].isActive = false;
        emit AgentDeactivated(wallet);
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
}
