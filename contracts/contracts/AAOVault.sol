// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./AAOTestToken.sol";
import "./AgentRegistry.sol";

contract AAOVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    AAOTestToken public testToken;
    bool public redemptionEnabled;

    /// @notice Optional agent registry for redemption validation
    AgentRegistry public agentRegistry;

    /// @notice Tokens per USDC unit (18 decimals). Default 1:1 = 1e18
    uint256 public exchangeRate;

    /// @notice Max mintIds per redemption request to prevent DoS
    uint256 public constant MAX_MINT_IDS = 50;

    /// @notice Cumulative deposit tracking per builder
    mapping(address => uint256) public builderDeposits;

    /// @notice Per-mintId replay protection (replaces broken timestamp-based hash)
    mapping(uint256 => bool) public redeemedMintIds;

    /// @notice Total USDC redeemed (for accounting)
    uint256 public totalDeposited;
    uint256 public totalRedeemed;

    struct RedemptionRequest {
        address agent;
        uint256 tokenAmount;
        uint256[] mintIds;
        uint256 minUsdcOut;
    }

    event Deposited(address indexed builder, uint256 amount, bool isOperator);
    event RedemptionToggled(bool enabled);
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event RedemptionProcessed(
        address indexed agent,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256[] mintIds
    );
    event EmergencyWithdraw(address indexed owner, uint256 amount);
    event AgentRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event TokensWithdrawn(address indexed owner, uint256 amount);

    constructor(address _usdc, address _testToken) Ownable(msg.sender) {
        require(_usdc != address(0), "Zero USDC address");
        require(_testToken != address(0), "Zero token address");
        usdc = IERC20(_usdc);
        testToken = AAOTestToken(_testToken);
        redemptionEnabled = false;
        exchangeRate = 1e18; // 1 token = 1 USDC unit by default
    }

    // ───────────────────── Pausable ─────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ───────────────────── Agent Registry ─────────────────────

    /// @notice Set the agent registry address (address(0) to disable check)
    function setAgentRegistry(address _registry) external onlyOwner {
        address old = address(agentRegistry);
        agentRegistry = AgentRegistry(_registry);
        emit AgentRegistryUpdated(old, _registry);
    }

    // ───────────────────── Deposits ─────────────────────

    /// @notice Builder deposits directly (msg.sender is builder)
    function deposit(uint256 usdcAmount) external whenNotPaused {
        require(usdcAmount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        builderDeposits[msg.sender] += usdcAmount;
        totalDeposited += usdcAmount;
        emit Deposited(msg.sender, usdcAmount, false);
    }

    /// @notice Operator deposits on behalf of builder.
    /// @dev Pulls USDC from msg.sender (owner/operator), credits to builder's account.
    /// The operator must hold sufficient USDC and have approved this contract.
    function depositFor(address builder, uint256 usdcAmount) external onlyOwner whenNotPaused {
        require(builder != address(0), "Zero builder address");
        require(usdcAmount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        builderDeposits[builder] += usdcAmount;
        totalDeposited += usdcAmount;
        emit Deposited(builder, usdcAmount, true);
    }

    /// @notice Returns cumulative deposits by this builder (not current available balance)
    function getBuilderDeposited(address builder) external view returns (uint256) {
        return builderDeposits[builder];
    }

    /// @notice Available USDC in the vault (total held by contract)
    function getAvailableBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ───────────────────── Exchange Rate ─────────────────────

    /// @notice Set the token-to-USDC exchange rate (tokens per USDC unit, 18 decimals)
    /// @param _rate e.g., 1e18 means 1 token = 1 USDC, 2e18 means 2 tokens per 1 USDC
    function setExchangeRate(uint256 _rate) external onlyOwner {
        require(_rate > 0, "Zero rate");
        uint256 old = exchangeRate;
        exchangeRate = _rate;
        emit ExchangeRateUpdated(old, _rate);
    }

    // ───────────────────── Redemption ─────────────────────

    function toggleRedemption(bool enabled) external onlyOwner {
        redemptionEnabled = enabled;
        emit RedemptionToggled(enabled);
    }

    /// @notice Agent redeems test tokens for USDC at the configured exchange rate.
    /// @dev USDC amount is computed on-chain from tokenAmount and exchangeRate.
    function requestRedemption(RedemptionRequest calldata req) external nonReentrant whenNotPaused {
        require(redemptionEnabled, "Redemption disabled");
        require(msg.sender == req.agent, "Caller must be agent");
        require(req.tokenAmount > 0, "Zero token amount");
        require(req.mintIds.length > 0, "Empty mintIds");
        require(req.mintIds.length <= MAX_MINT_IDS, "Too many mintIds");

        // If agent registry is set, verify agent is registered and active
        if (address(agentRegistry) != address(0)) {
            require(agentRegistry.isRegisteredAgent(req.agent), "Agent not registered or inactive");
        }

        // Per-mintId replay protection — check AND mark in single loop (prevents duplicate mintIds in same request)
        for (uint256 i = 0; i < req.mintIds.length; i++) {
            require(!redeemedMintIds[req.mintIds[i]], "MintId already redeemed");
            redeemedMintIds[req.mintIds[i]] = true;
        }

        // Compute USDC amount from exchange rate (on-chain, not caller-supplied)
        uint256 usdcAmount = (req.tokenAmount * 1e18) / exchangeRate;
        require(usdcAmount > 0, "USDC amount rounds to zero");

        // Slippage protection
        require(usdcAmount >= req.minUsdcOut, "USDC output below minimum");

        // Validate ownership and amounts
        require(_validateRedemption(req, usdcAmount), "Validation failed");

        totalRedeemed += usdcAmount;

        // Transfer test tokens from agent to vault (burn equivalent)
        IERC20(address(testToken)).safeTransferFrom(req.agent, address(this), req.tokenAmount);

        // Transfer USDC to agent
        usdc.safeTransfer(req.agent, usdcAmount);

        emit RedemptionProcessed(req.agent, req.tokenAmount, usdcAmount, req.mintIds);
    }

    function _validateRedemption(RedemptionRequest calldata req, uint256 usdcAmount) internal view returns (bool) {
        // 1. Agent holds enough tokens
        if (testToken.balanceOf(req.agent) < req.tokenAmount) return false;

        // 2. All mintIds exist and belong to this agent
        uint256 totalMintedAmount;
        for (uint256 i = 0; i < req.mintIds.length; i++) {
            uint256 mintId = req.mintIds[i];
            if (mintId >= testToken.nextMintId()) return false;

            (
                address agent,
                uint256 amount,
                ,
                ,
                ,
            ) = testToken.mintRecords(mintId);

            if (agent != req.agent) return false;
            totalMintedAmount += amount;
        }

        // 3. Requested token amount doesn't exceed minted total from these IDs
        if (req.tokenAmount > totalMintedAmount) return false;

        // 4. Vault has enough USDC
        if (usdc.balanceOf(address(this)) < usdcAmount) return false;

        return true;
    }

    // ───────────────────── Emergency ─────────────────────

    function withdraw(uint256 amount) external onlyOwner {
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        usdc.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    /// @notice Withdraw accumulated test tokens from the vault
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(IERC20(address(testToken)).balanceOf(address(this)) >= amount, "Insufficient token balance");
        IERC20(address(testToken)).safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(msg.sender, amount);
    }
}
