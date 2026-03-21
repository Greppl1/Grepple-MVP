// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title IToolRegistry — Standard interface for on-chain MCP tool registries
/// @author AAO Launchpad (Grepple)
/// @notice Any contract implementing this interface can serve as an agent-queryable
///         tool registry. Agents and other contracts use ERC-165 `supportsInterface`
///         to discover registry capabilities on-chain.
/// @dev Interface ID: see `type(IToolRegistry).interfaceId`
interface IToolRegistry {

    // ===== Data Structures =====

    /// @notice Core on-chain record for a registered MCP tool.
    ///         Large fields (name, description, schema) live off-chain at `metadataURI`;
    ///         `metadataHash` allows anyone to verify integrity.
    struct ToolRecord {
        bytes32 clusterId;
        uint16  clusterPoolSize;
        uint8   failureMode;          // 0=healthy 1=schema 2=description 3=compatibility 4=mixed
        uint8   requiredFieldCount;
        uint8   totalFieldCount;
        uint8   nestingDepth;
        bool    hasDefaults;
        string  metadataURI;
        bytes32 metadataHash;
        uint64  registeredAt;
        uint64  lastUpdated;
        address submitter;
        bool    exists;
        bool    active;
    }

    /// @notice A single benchmark run result, append-only (never overwritten).
    struct BenchmarkRun {
        uint64  runId;
        bytes32 modelId;
        uint8   invokeRate;           // 0-100
        uint8   mentionRate;          // 0-100
        uint8   silentRate;           // 0-100
        uint8   errorRate;            // 0-100
        bool    passesStrictValidation;
        bool    under128Limit;
        uint64  timestamp;
        string  benchmarkVersion;
    }

    // ===== Errors =====

    error ToolAlreadyRegistered(bytes32 toolId);
    error ToolNotFound(bytes32 toolId);
    error ToolAlreadyActive(bytes32 toolId);
    error ToolAlreadyInactive(bytes32 toolId);
    error InvalidFailureMode(uint8 mode);
    error RateOutOfRange(uint8 rate);
    error ArrayLengthMismatch();
    error NoResultsForModel(bytes32 toolId, bytes32 modelId);

    // ===== Events =====

    event ToolRegistered(bytes32 indexed toolId, bytes32 indexed clusterId, address submitter);
    event ToolUpdated(bytes32 indexed toolId, string metadataURI, bytes32 metadataHash);
    event ToolDeactivated(bytes32 indexed toolId);
    event ToolReactivated(bytes32 indexed toolId);
    event BenchmarkRecorded(bytes32 indexed toolId, bytes32 indexed modelId, uint64 runId, uint8 invokeRate);

    // ===== Write =====

    /// @notice Register a new tool in the registry.
    function registerTool(
        bytes32 toolId,
        bytes32 clusterId,
        uint16  clusterPoolSize,
        uint8   failureMode,
        uint8   requiredFieldCount,
        uint8   totalFieldCount,
        uint8   nestingDepth,
        bool    hasDefaults,
        string calldata metadataURI,
        bytes32 metadataHash
    ) external;

    /// @notice Update off-chain metadata pointer and schema metrics for an existing tool.
    function updateToolMetadata(
        bytes32 toolId,
        uint8   failureMode,
        uint8   requiredFieldCount,
        uint8   totalFieldCount,
        uint8   nestingDepth,
        bool    hasDefaults,
        string calldata metadataURI,
        bytes32 metadataHash
    ) external;

    /// @notice Deactivate a tool (soft-delete, data preserved).
    function deactivateTool(bytes32 toolId) external;

    /// @notice Reactivate a previously deactivated tool.
    function reactivateTool(bytes32 toolId) external;

    /// @notice Record a single benchmark run for a tool + model pair.
    function recordBenchmarkRun(
        bytes32 toolId,
        bytes32 modelId,
        uint8   invokeRate,
        uint8   mentionRate,
        uint8   silentRate,
        uint8   errorRate,
        bool    passesStrictValidation,
        bool    under128Limit,
        string calldata benchmarkVersion
    ) external;

    // ===== Read =====

    /// @notice Get core tool record.
    function getTool(bytes32 toolId) external view returns (ToolRecord memory);

    /// @notice Get a specific benchmark run by its global runId.
    function getBenchmarkRun(bytes32 toolId, uint64 runId) external view returns (BenchmarkRun memory);

    /// @notice Get the latest benchmark result for a tool + model pair.
    function getLatestResult(bytes32 toolId, bytes32 modelId) external view returns (BenchmarkRun memory);

    /// @notice Total number of benchmark runs recorded for a tool.
    function getToolRunCount(bytes32 toolId) external view returns (uint64);

    /// @notice List all tool IDs within a cluster.
    function getClusterTools(bytes32 clusterId) external view returns (bytes32[] memory);

    /// @notice Total number of registered tools.
    function totalTools() external view returns (uint256);

    // ===== Helpers =====

    /// @notice Deterministic, collision-resistant tool ID derivation.
    function computeToolId(string calldata name, string calldata mcpServerUrl) external pure returns (bytes32);

    /// @notice Deterministic model ID derivation.
    function computeModelId(string calldata modelName) external pure returns (bytes32);

    /// @notice Deterministic cluster ID derivation.
    function computeClusterId(string calldata clusterName) external pure returns (bytes32);
}
