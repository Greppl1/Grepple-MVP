// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AAOTestToken.sol";

contract AAOVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    AAOTestToken public testToken;
    bool public redemptionEnabled;

    mapping(address => uint256) public builderDeposits;
    mapping(bytes32 => bool) public processedRedemptions;

    struct RedemptionRequest {
        address agent;
        uint256 tokenAmount;
        uint256[] mintIds;
        uint256 usdcAmount;
    }

    event Deposited(address indexed builder, uint256 amount);
    event RedemptionToggled(bool enabled);
    event RedemptionProcessed(
        address indexed agent,
        uint256 tokenAmount,
        uint256 usdcAmount,
        bytes32 redemptionHash
    );
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    constructor(address _usdc, address _testToken) Ownable(msg.sender) {
        require(_usdc != address(0), "Zero USDC address");
        require(_testToken != address(0), "Zero token address");
        usdc = IERC20(_usdc);
        testToken = AAOTestToken(_testToken);
        redemptionEnabled = false;
    }

    /// @notice Builder deposits directly (msg.sender is builder)
    function deposit(uint256 usdcAmount) external {
        require(usdcAmount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        builderDeposits[msg.sender] += usdcAmount;
        emit Deposited(msg.sender, usdcAmount);
    }

    /// @notice Operator deposits on behalf of builder (backend pattern)
    function depositFor(address builder, uint256 usdcAmount) external onlyOwner {
        require(builder != address(0), "Zero builder address");
        require(usdcAmount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        builderDeposits[builder] += usdcAmount;
        emit Deposited(builder, usdcAmount);
    }

    function getBuilderBalance(address builder) external view returns (uint256) {
        return builderDeposits[builder];
    }

    function toggleRedemption(bool enabled) external onlyOwner {
        redemptionEnabled = enabled;
        emit RedemptionToggled(enabled);
    }

    /// @notice Redemption (placeholder — disabled by default, future feature)
    function requestRedemption(RedemptionRequest calldata req) external nonReentrant {
        require(redemptionEnabled, "Redemption disabled");
        require(msg.sender == req.agent, "Caller must be agent");
        require(req.tokenAmount > 0, "Zero token amount");
        require(req.usdcAmount > 0, "Zero USDC amount");

        bytes32 redemptionHash = keccak256(
            abi.encodePacked(req.agent, req.tokenAmount, req.usdcAmount, block.timestamp)
        );
        require(!processedRedemptions[redemptionHash], "Already processed");

        require(_validateRedemption(req), "Validation failed");

        processedRedemptions[redemptionHash] = true;

        // Transfer test tokens from agent to vault (burn equivalent)
        IERC20(address(testToken)).safeTransferFrom(req.agent, address(this), req.tokenAmount);

        // Transfer USDC to agent
        usdc.safeTransfer(req.agent, req.usdcAmount);

        emit RedemptionProcessed(req.agent, req.tokenAmount, req.usdcAmount, redemptionHash);
    }

    function _validateRedemption(RedemptionRequest calldata req) internal view returns (bool) {
        // 1. Agent holds enough tokens
        if (testToken.balanceOf(req.agent) < req.tokenAmount) return false;

        // 2. All mintIds exist and belong to this agent
        uint256 totalMintedAmount;
        for (uint256 i = 0; i < req.mintIds.length; i++) {
            uint256 mintId = req.mintIds[i];
            if (mintId >= testToken.nextMintId()) return false;

            (
                ,
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
        if (usdc.balanceOf(address(this)) < req.usdcAmount) return false;

        return true;
    }

    function withdraw(uint256 amount) external onlyOwner {
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        usdc.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }
}
