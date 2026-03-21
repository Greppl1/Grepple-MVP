// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IToolRegistry.sol";

/// @title AAORegistry — On-chain MCP Tool Registry for AAO Launchpad
/// @author AAO Launchpad (Grepple)
/// @notice Production-grade, upgradeable registry that stores MCP tool metadata
///         and append-only benchmark results. Designed for agent-to-agent discovery:
///         agents query this contract to find, evaluate, and select tools.
/// @dev Implements IToolRegistry + ERC-165. Uses UUPS proxy pattern for upgradeability,
///      OpenZeppelin AccessControl for role-based permissions, and Pausable for
///      emergency stops. Large data lives off-chain (IPFS/HTTP) with on-chain
///      integrity verification via metadataHash.
contract AAORegistry is
    IToolRegistry,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ===== Constants =====

    /// @notice Semantic version, incremented on each upgrade.
    string public constant VERSION = "3.2.0";

    /// @notice Role that can register tools, record benchmarks, and update metadata.
    bytes32 public constant WRITER_ROLE = keccak256("WRITER_ROLE");

    /// @notice Role that can pause/unpause the contract in emergencies.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ===== Storage =====

    /// @dev toolId => ToolRecord
    mapping(bytes32 => ToolRecord) private _tools;

    /// @dev toolId => runId => BenchmarkRun
    mapping(bytes32 => mapping(uint64 => BenchmarkRun)) private _benchmarkRuns;

    /// @dev toolId => total run count
    mapping(bytes32 => uint64) private _toolRunCount;

    /// @dev toolId => modelId => latest runId (for quick lookup)
    mapping(bytes32 => mapping(bytes32 => uint64)) private _latestRunByModel;

    /// @dev clusterId => toolId[]
    mapping(bytes32 => bytes32[]) private _clusterTools;

    /// @dev All registered tool IDs (append-only)
    bytes32[] private _allToolIds;

    /// @dev Global run ID counter (starts at 1; 0 means "no run")
    uint64 public nextRunId;

    /// @dev All registered cluster IDs
    bytes32[] private _allClusterIds;

    /// @dev Quick existence check for clusters
    mapping(bytes32 => bool) private _clusterExists;

    // ===== Call Record Storage (V3.2) =====

    /// @dev callRecordHash => CallRecord
    mapping(bytes32 => CallRecord) private _callRecords;

    /// @dev toolId => callRecordHash[]
    mapping(bytes32 => bytes32[]) private _toolCallRecords;

    /// @dev agentWallet => callRecordHash[]
    mapping(address => bytes32[]) private _agentCallRecords;

    // ===== Storage gap for future upgrades =====

    /// @dev Reserved storage slots for future versions (UUPS best practice).
    uint256[41] private __gap;

    // ===== Constructor + Initializer =====

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the registry. Called once through the proxy.
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE (can grant/revoke all roles).
    function initialize(address admin) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(WRITER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        nextRunId = 1;
    }

    // ===== UUPS authorization =====

    /// @dev Only DEFAULT_ADMIN_ROLE can authorize upgrades.
    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // ===== ERC-165 =====

    /// @notice Returns true if this contract implements `interfaceId`.
    /// @dev Supports IToolRegistry, AccessControl, ERC-165.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IToolRegistry).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // ===== Pause / Unpause =====

    /// @notice Emergency pause — halts all write operations.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resume normal operations after a pause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ===== Internal helpers =====

    /// @dev Reverts if failureMode > 4.
    function _validateFailureMode(uint8 mode) private pure {
        if (mode > 4) revert InvalidFailureMode(mode);
    }

    /// @dev Reverts if any rate > 100.
    function _validateRates(uint8 a, uint8 b, uint8 c, uint8 d) private pure {
        if (a > 100 || b > 100 || c > 100 || d > 100) {
            // report the first offending rate
            if (a > 100) revert RateOutOfRange(a);
            if (b > 100) revert RateOutOfRange(b);
            if (c > 100) revert RateOutOfRange(c);
            revert RateOutOfRange(d);
        }
    }

    // ===== Write Functions =====

    /// @inheritdoc IToolRegistry
    function registerTool(
        bytes32 _toolId,
        bytes32 _clusterId,
        uint16  _clusterPoolSize,
        uint8   _failureMode,
        uint8   _requiredFieldCount,
        uint8   _totalFieldCount,
        uint8   _nestingDepth,
        bool    _hasDefaults,
        string calldata _metadataURI,
        bytes32 _metadataHash
    ) external override onlyRole(WRITER_ROLE) whenNotPaused {
        if (_tools[_toolId].exists) revert ToolAlreadyRegistered(_toolId);
        _validateFailureMode(_failureMode);

        if (!_clusterExists[_clusterId]) {
            _allClusterIds.push(_clusterId);
            _clusterExists[_clusterId] = true;
        }

        _tools[_toolId] = ToolRecord({
            clusterId: _clusterId,
            clusterPoolSize: _clusterPoolSize,
            failureMode: _failureMode,
            requiredFieldCount: _requiredFieldCount,
            totalFieldCount: _totalFieldCount,
            nestingDepth: _nestingDepth,
            hasDefaults: _hasDefaults,
            metadataURI: _metadataURI,
            metadataHash: _metadataHash,
            registeredAt: uint64(block.timestamp),
            lastUpdated: uint64(block.timestamp),
            submitter: msg.sender,
            exists: true,
            active: true
        });

        _allToolIds.push(_toolId);
        _clusterTools[_clusterId].push(_toolId);

        emit ToolRegistered(_toolId, _clusterId, msg.sender);
    }

    /// @inheritdoc IToolRegistry
    function updateToolMetadata(
        bytes32 _toolId,
        uint8   _failureMode,
        uint8   _requiredFieldCount,
        uint8   _totalFieldCount,
        uint8   _nestingDepth,
        bool    _hasDefaults,
        string calldata _metadataURI,
        bytes32 _metadataHash
    ) external override onlyRole(WRITER_ROLE) whenNotPaused {
        if (!_tools[_toolId].exists) revert ToolNotFound(_toolId);
        _validateFailureMode(_failureMode);

        ToolRecord storage tool = _tools[_toolId];
        tool.failureMode = _failureMode;
        tool.requiredFieldCount = _requiredFieldCount;
        tool.totalFieldCount = _totalFieldCount;
        tool.nestingDepth = _nestingDepth;
        tool.hasDefaults = _hasDefaults;
        tool.metadataURI = _metadataURI;
        tool.metadataHash = _metadataHash;
        tool.lastUpdated = uint64(block.timestamp);

        emit ToolUpdated(_toolId, _metadataURI, _metadataHash);
    }

    /// @inheritdoc IToolRegistry
    function deactivateTool(bytes32 _toolId)
        external
        override
        onlyRole(WRITER_ROLE)
        whenNotPaused
    {
        if (!_tools[_toolId].exists) revert ToolNotFound(_toolId);
        if (!_tools[_toolId].active) revert ToolAlreadyInactive(_toolId);
        _tools[_toolId].active = false;
        _tools[_toolId].lastUpdated = uint64(block.timestamp);
        emit ToolDeactivated(_toolId);
    }

    /// @inheritdoc IToolRegistry
    function reactivateTool(bytes32 _toolId)
        external
        override
        onlyRole(WRITER_ROLE)
        whenNotPaused
    {
        if (!_tools[_toolId].exists) revert ToolNotFound(_toolId);
        if (_tools[_toolId].active) revert ToolAlreadyActive(_toolId);
        _tools[_toolId].active = true;
        _tools[_toolId].lastUpdated = uint64(block.timestamp);
        emit ToolReactivated(_toolId);
    }

    /// @inheritdoc IToolRegistry
    function recordBenchmarkRun(
        bytes32 _toolId,
        bytes32 _modelId,
        uint8   _invokeRate,
        uint8   _mentionRate,
        uint8   _silentRate,
        uint8   _errorRate,
        bool    _passesStrictValidation,
        bool    _under128Limit,
        string calldata _benchmarkVersion
    ) external override onlyRole(WRITER_ROLE) whenNotPaused {
        if (!_tools[_toolId].exists) revert ToolNotFound(_toolId);
        _validateRates(_invokeRate, _mentionRate, _silentRate, _errorRate);

        uint64 runId = nextRunId++;

        _benchmarkRuns[_toolId][runId] = BenchmarkRun({
            runId: runId,
            modelId: _modelId,
            invokeRate: _invokeRate,
            mentionRate: _mentionRate,
            silentRate: _silentRate,
            errorRate: _errorRate,
            passesStrictValidation: _passesStrictValidation,
            under128Limit: _under128Limit,
            timestamp: uint64(block.timestamp),
            benchmarkVersion: _benchmarkVersion
        });

        _toolRunCount[_toolId]++;
        _latestRunByModel[_toolId][_modelId] = runId;
        _tools[_toolId].lastUpdated = uint64(block.timestamp);

        emit BenchmarkRecorded(_toolId, _modelId, runId, _invokeRate);
    }

    /// @notice Record benchmark runs for one tool across multiple models in a single tx.
    /// @dev Saves gas vs. calling recordBenchmarkRun() N times.
    /// @param _toolId        The tool being benchmarked.
    /// @param _modelIds      Array of model IDs tested.
    /// @param _invokeRates   Parallel array — invoke rate per model.
    /// @param _mentionRates  Parallel array — mention rate per model.
    /// @param _silentRates   Parallel array — silent rate per model.
    /// @param _errorRates    Parallel array — error rate per model.
    /// @param _passesStrictValidations Parallel array — strict validation flag.
    /// @param _under128Limits          Parallel array — under-128 flag.
    /// @param _benchmarkVersion        Version string shared across all runs.
    function batchRecordBenchmarkRuns(
        bytes32   _toolId,
        bytes32[] calldata _modelIds,
        uint8[]   calldata _invokeRates,
        uint8[]   calldata _mentionRates,
        uint8[]   calldata _silentRates,
        uint8[]   calldata _errorRates,
        bool[]    calldata _passesStrictValidations,
        bool[]    calldata _under128Limits,
        string    calldata _benchmarkVersion
    ) external onlyRole(WRITER_ROLE) whenNotPaused {
        if (!_tools[_toolId].exists) revert ToolNotFound(_toolId);
        uint256 len = _modelIds.length;
        if (
            len != _invokeRates.length ||
            len != _mentionRates.length ||
            len != _silentRates.length ||
            len != _errorRates.length ||
            len != _passesStrictValidations.length ||
            len != _under128Limits.length
        ) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < len; i++) {
            _validateRates(
                _invokeRates[i], _mentionRates[i],
                _silentRates[i], _errorRates[i]
            );

            uint64 runId = nextRunId++;

            _benchmarkRuns[_toolId][runId] = BenchmarkRun({
                runId: runId,
                modelId: _modelIds[i],
                invokeRate: _invokeRates[i],
                mentionRate: _mentionRates[i],
                silentRate: _silentRates[i],
                errorRate: _errorRates[i],
                passesStrictValidation: _passesStrictValidations[i],
                under128Limit: _under128Limits[i],
                timestamp: uint64(block.timestamp),
                benchmarkVersion: _benchmarkVersion
            });

            _toolRunCount[_toolId]++;
            _latestRunByModel[_toolId][_modelIds[i]] = runId;

            emit BenchmarkRecorded(_toolId, _modelIds[i], runId, _invokeRates[i]);
        }

        _tools[_toolId].lastUpdated = uint64(block.timestamp);
    }

    /// @inheritdoc IToolRegistry
    /// @dev callRecordHash = keccak256(UTF-8 bytes of call_record_id).
    ///      Must match the hash Zian writes into TokenMintRecord.
    function recordCall(
        bytes32 _callRecordHash,
        bytes32 _toolId,
        address _agentWallet,
        bool    _success
    ) external override onlyRole(WRITER_ROLE) whenNotPaused {
        if (!_tools[_toolId].exists) revert ToolNotFound(_toolId);
        if (_callRecords[_callRecordHash].exists) revert CallRecordAlreadyExists(_callRecordHash);

        _callRecords[_callRecordHash] = CallRecord({
            toolId: _toolId,
            agentWallet: _agentWallet,
            success: _success,
            timestamp: uint64(block.timestamp),
            exists: true
        });

        _toolCallRecords[_toolId].push(_callRecordHash);
        _agentCallRecords[_agentWallet].push(_callRecordHash);

        emit CallRecorded(_callRecordHash, _toolId, _agentWallet, _success);
    }

    // ===== Read Functions (free) =====

    /// @inheritdoc IToolRegistry
    function getTool(bytes32 _toolId)
        external view override returns (ToolRecord memory)
    {
        return _tools[_toolId];
    }

    /// @inheritdoc IToolRegistry
    function getBenchmarkRun(bytes32 _toolId, uint64 _runId)
        external view override returns (BenchmarkRun memory)
    {
        return _benchmarkRuns[_toolId][_runId];
    }

    /// @inheritdoc IToolRegistry
    function getLatestResult(bytes32 _toolId, bytes32 _modelId)
        external view override returns (BenchmarkRun memory)
    {
        uint64 runId = _latestRunByModel[_toolId][_modelId];
        if (runId == 0) revert NoResultsForModel(_toolId, _modelId);
        return _benchmarkRuns[_toolId][runId];
    }

    /// @inheritdoc IToolRegistry
    function getToolRunCount(bytes32 _toolId)
        external view override returns (uint64)
    {
        return _toolRunCount[_toolId];
    }

    /// @inheritdoc IToolRegistry
    function verifyCallRecord(bytes32 _callRecordHash)
        external view override returns (bool)
    {
        return _callRecords[_callRecordHash].exists;
    }

    /// @inheritdoc IToolRegistry
    function getCallRecord(bytes32 _callRecordHash)
        external view override returns (CallRecord memory)
    {
        if (!_callRecords[_callRecordHash].exists) revert CallRecordNotFound(_callRecordHash);
        return _callRecords[_callRecordHash];
    }

    /// @notice Get all call record hashes for a tool.
    /// @param _toolId Tool to query.
    /// @return Array of call record hashes.
    function getToolCallRecords(bytes32 _toolId)
        external view returns (bytes32[] memory)
    {
        return _toolCallRecords[_toolId];
    }

    /// @notice Get all call record hashes for an agent.
    /// @param _agentWallet Agent wallet address.
    /// @return Array of call record hashes.
    function getAgentCallRecords(address _agentWallet)
        external view returns (bytes32[] memory)
    {
        return _agentCallRecords[_agentWallet];
    }

    /// @inheritdoc IToolRegistry
    function getClusterTools(bytes32 _clusterId)
        external view override returns (bytes32[] memory)
    {
        return _clusterTools[_clusterId];
    }

    /// @notice Paginated version of getClusterTools.
    /// @param _clusterId Cluster to query.
    /// @param _start     Start index.
    /// @param _count     Max items to return.
    /// @return Slice of tool IDs.
    function getClusterToolsPaginated(
        bytes32 _clusterId,
        uint256 _start,
        uint256 _count
    ) external view returns (bytes32[] memory) {
        bytes32[] storage arr = _clusterTools[_clusterId];
        if (_start >= arr.length) return new bytes32[](0);
        uint256 end = _start + _count;
        if (end > arr.length) end = arr.length;

        bytes32[] memory result = new bytes32[](end - _start);
        for (uint256 i = _start; i < end; i++) {
            result[i - _start] = arr[i];
        }
        return result;
    }

    /// @notice Returns all registered cluster IDs.
    function getAllClusterIds() external view returns (bytes32[] memory) {
        return _allClusterIds;
    }

    /// @inheritdoc IToolRegistry
    function totalTools() external view override returns (uint256) {
        return _allToolIds.length;
    }

    /// @notice Paginated access to the global tool ID list.
    /// @param _start Start index.
    /// @param _count Max items to return.
    /// @return Slice of tool IDs.
    function getToolIds(uint256 _start, uint256 _count)
        external view returns (bytes32[] memory)
    {
        if (_start >= _allToolIds.length) return new bytes32[](0);
        uint256 end = _start + _count;
        if (end > _allToolIds.length) end = _allToolIds.length;

        bytes32[] memory result = new bytes32[](end - _start);
        for (uint256 i = _start; i < end; i++) {
            result[i - _start] = _allToolIds[i];
        }
        return result;
    }

    // ===== Helpers =====

    /// @inheritdoc IToolRegistry
    /// @dev Uses abi.encode (not abi.encodePacked) to prevent hash collisions
    ///      between different (name, url) pairs with the same concatenation.
    function computeToolId(string calldata _name, string calldata _mcpServerUrl)
        external pure override returns (bytes32)
    {
        return keccak256(abi.encode(_name, _mcpServerUrl));
    }

    /// @inheritdoc IToolRegistry
    function computeModelId(string calldata _modelName)
        external pure override returns (bytes32)
    {
        return keccak256(abi.encodePacked(_modelName));
    }

    /// @inheritdoc IToolRegistry
    function computeClusterId(string calldata _clusterName)
        external pure override returns (bytes32)
    {
        return keccak256(abi.encodePacked(_clusterName));
    }

    /// @inheritdoc IToolRegistry
    /// @dev Identical to Zian's hash: keccak256(UTF-8 bytes of callRecordId).
    ///      Example: computeCallRecordHash("cr_20260320_xyz789")
    function computeCallRecordHash(string calldata _callRecordId)
        external pure override returns (bytes32)
    {
        return keccak256(abi.encodePacked(_callRecordId));
    }
}
