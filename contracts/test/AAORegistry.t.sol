// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../src/AAORegistry.sol";
import "../src/IToolRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract AAORegistryTest is Test {
    AAORegistry public registry;
    AAORegistry public implementation;

    address admin = address(this);
    address writer = address(0x1);
    address pauser = address(0x2);
    address unauthorized = address(0x3);

    bytes32 toolId;
    bytes32 clusterId;
    bytes32 modelId;

    bytes32 constant WRITER_ROLE = keccak256("WRITER_ROLE");
    bytes32 constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function setUp() public {
        // Deploy behind UUPS proxy
        implementation = new AAORegistry();
        bytes memory initData = abi.encodeCall(AAORegistry.initialize, (admin));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        registry = AAORegistry(address(proxy));

        // Grant roles
        registry.grantRole(WRITER_ROLE, writer);
        registry.grantRole(PAUSER_ROLE, pauser);

        // Precompute IDs — uses abi.encode (collision-resistant)
        toolId = keccak256(abi.encode("swap_tokens", "https://mcp.example.com/swap"));
        clusterId = keccak256(abi.encodePacked("dex_swap"));
        modelId = keccak256(abi.encodePacked("claude-4.6"));
    }

    // ===== Helper =====

    function _registerTool(bytes32 _toolId, bytes32 _clusterId) internal {
        vm.prank(writer);
        registry.registerTool(
            _toolId, _clusterId,
            10, 0, 3, 5, 2, true,
            "https://api.example.com/metadata/swap",
            keccak256("metadata content")
        );
    }

    // ===== Initialization =====

    function test_initialize_setsAdmin() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_initialize_setsWriterAndPauserOnAdmin() public view {
        assertTrue(registry.hasRole(WRITER_ROLE, admin));
        assertTrue(registry.hasRole(PAUSER_ROLE, admin));
    }

    function test_initialize_cannotReinitialize() public {
        vm.expectRevert();
        registry.initialize(address(0x99));
    }

    function test_nextRunId_startsAtOne() public view {
        assertEq(registry.nextRunId(), 1);
    }

    function test_version() public view {
        assertEq(keccak256(bytes(registry.VERSION())), keccak256(bytes("3.2.0")));
    }

    // ===== ERC-165 =====

    function test_supportsInterface_IToolRegistry() public view {
        assertTrue(registry.supportsInterface(type(IToolRegistry).interfaceId));
    }

    function test_supportsInterface_AccessControl() public view {
        assertTrue(registry.supportsInterface(type(IAccessControl).interfaceId));
    }

    function test_supportsInterface_ERC165() public view {
        assertTrue(registry.supportsInterface(0x01ffc9a7));
    }

    function test_supportsInterface_random_returnsFalse() public view {
        assertFalse(registry.supportsInterface(0xdeadbeef));
    }

    // ===== Access Control =====

    function test_grantWriterRole() public {
        address newWriter = address(0x4);
        registry.grantRole(WRITER_ROLE, newWriter);
        assertTrue(registry.hasRole(WRITER_ROLE, newWriter));
    }

    function test_revokeWriterRole() public {
        registry.revokeRole(WRITER_ROLE, writer);
        assertFalse(registry.hasRole(WRITER_ROLE, writer));
    }

    function test_revert_grantRole_notAdmin() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.grantRole(WRITER_ROLE, address(0x5));
    }

    // ===== Pause / Unpause =====

    function test_pause_blocksWrites() public {
        vm.prank(pauser);
        registry.pause();

        vm.prank(writer);
        vm.expectRevert();
        registry.registerTool(toolId, clusterId, 10, 0, 3, 5, 2, true, "uri", bytes32(0));
    }

    function test_unpause_resumesWrites() public {
        vm.prank(pauser);
        registry.pause();
        vm.prank(pauser);
        registry.unpause();

        _registerTool(toolId, clusterId);
        assertEq(registry.totalTools(), 1);
    }

    function test_revert_pause_notPauser() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.pause();
    }

    // ===== Register Tool =====

    function test_registerTool() public {
        _registerTool(toolId, clusterId);

        IToolRegistry.ToolRecord memory tool = registry.getTool(toolId);
        assertTrue(tool.exists);
        assertTrue(tool.active);
        assertEq(tool.clusterId, clusterId);
        assertEq(tool.clusterPoolSize, 10);
        assertEq(tool.failureMode, 0);
        assertEq(tool.requiredFieldCount, 3);
        assertEq(tool.totalFieldCount, 5);
        assertEq(tool.nestingDepth, 2);
        assertTrue(tool.hasDefaults);
        assertEq(tool.submitter, writer);
    }

    function test_registerTool_updatesCounters() public {
        _registerTool(toolId, clusterId);
        assertEq(registry.totalTools(), 1);

        bytes32[] memory tools = registry.getClusterTools(clusterId);
        assertEq(tools.length, 1);
        assertEq(tools[0], toolId);
    }

    function test_registerTool_createsCluster() public {
        _registerTool(toolId, clusterId);
        bytes32[] memory clusters = registry.getAllClusterIds();
        assertEq(clusters.length, 1);
        assertEq(clusters[0], clusterId);
    }

    function test_registerTool_existingCluster_noDuplicate() public {
        _registerTool(toolId, clusterId);
        bytes32 toolId2 = keccak256(abi.encode("bridge_tokens", "https://mcp.example.com/bridge"));
        _registerTool(toolId2, clusterId);

        bytes32[] memory clusters = registry.getAllClusterIds();
        assertEq(clusters.length, 1);
        assertEq(registry.getClusterTools(clusterId).length, 2);
    }

    function test_revert_registerTool_duplicate() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.ToolAlreadyRegistered.selector, toolId));
        registry.registerTool(toolId, clusterId, 10, 0, 3, 5, 2, true, "uri", bytes32(0));
    }

    function test_revert_registerTool_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.registerTool(toolId, clusterId, 10, 0, 3, 5, 2, true, "uri", bytes32(0));
    }

    function test_revert_registerTool_invalidFailureMode() public {
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.InvalidFailureMode.selector, 5));
        registry.registerTool(toolId, clusterId, 10, 5, 3, 5, 2, true, "uri", bytes32(0));
    }

    // ===== Update Tool Metadata =====

    function test_updateToolMetadata() public {
        _registerTool(toolId, clusterId);

        vm.warp(block.timestamp + 100);
        vm.prank(writer);
        registry.updateToolMetadata(
            toolId, 1, 4, 6, 3, false, "ipfs://new", keccak256("new metadata")
        );

        IToolRegistry.ToolRecord memory tool = registry.getTool(toolId);
        assertEq(tool.failureMode, 1);
        assertEq(tool.requiredFieldCount, 4);
        assertEq(tool.totalFieldCount, 6);
        assertEq(tool.nestingDepth, 3);
        assertFalse(tool.hasDefaults);
        assertEq(tool.metadataHash, keccak256("new metadata"));
        assertEq(tool.lastUpdated, uint64(block.timestamp));
    }

    function test_revert_updateToolMetadata_notFound() public {
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.ToolNotFound.selector, toolId));
        registry.updateToolMetadata(toolId, 0, 0, 0, 0, false, "", bytes32(0));
    }

    function test_revert_updateToolMetadata_invalidFailureMode() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.InvalidFailureMode.selector, 6));
        registry.updateToolMetadata(toolId, 6, 0, 0, 0, false, "", bytes32(0));
    }

    // ===== Deactivate / Reactivate =====

    function test_deactivateTool() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        registry.deactivateTool(toolId);

        IToolRegistry.ToolRecord memory tool = registry.getTool(toolId);
        assertFalse(tool.active);
        assertTrue(tool.exists);
    }

    function test_reactivateTool() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        registry.deactivateTool(toolId);
        vm.prank(writer);
        registry.reactivateTool(toolId);

        assertTrue(registry.getTool(toolId).active);
    }

    function test_revert_deactivate_alreadyInactive() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        registry.deactivateTool(toolId);
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.ToolAlreadyInactive.selector, toolId));
        registry.deactivateTool(toolId);
    }

    function test_revert_reactivate_alreadyActive() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.ToolAlreadyActive.selector, toolId));
        registry.reactivateTool(toolId);
    }

    // ===== Benchmark Runs =====

    function test_recordBenchmarkRun() public {
        _registerTool(toolId, clusterId);

        vm.prank(writer);
        registry.recordBenchmarkRun(toolId, modelId, 85, 70, 10, 5, true, true, "v2");

        assertEq(registry.getToolRunCount(toolId), 1);

        IToolRegistry.BenchmarkRun memory run = registry.getLatestResult(toolId, modelId);
        assertEq(run.runId, 1);
        assertEq(run.modelId, modelId);
        assertEq(run.invokeRate, 85);
        assertEq(run.mentionRate, 70);
        assertEq(run.silentRate, 10);
        assertEq(run.errorRate, 5);
        assertTrue(run.passesStrictValidation);
        assertTrue(run.under128Limit);
    }

    function test_recordBenchmarkRun_appendOnly() public {
        _registerTool(toolId, clusterId);

        vm.prank(writer);
        registry.recordBenchmarkRun(toolId, modelId, 60, 50, 20, 15, false, true, "v2");
        vm.prank(writer);
        registry.recordBenchmarkRun(toolId, modelId, 85, 70, 10, 5, true, true, "v2");

        assertEq(registry.getToolRunCount(toolId), 2);

        IToolRegistry.BenchmarkRun memory latest = registry.getLatestResult(toolId, modelId);
        assertEq(latest.invokeRate, 85);
        assertEq(latest.runId, 2);

        IToolRegistry.BenchmarkRun memory first = registry.getBenchmarkRun(toolId, 1);
        assertEq(first.invokeRate, 60);
    }

    function test_revert_recordBenchmark_toolNotFound() public {
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.ToolNotFound.selector, toolId));
        registry.recordBenchmarkRun(toolId, modelId, 85, 70, 10, 5, true, true, "v2");
    }

    function test_revert_recordBenchmark_rateOver100() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.RateOutOfRange.selector, 101));
        registry.recordBenchmarkRun(toolId, modelId, 101, 70, 10, 5, true, true, "v2");
    }

    function test_revert_getLatestResult_noResults() public {
        _registerTool(toolId, clusterId);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.NoResultsForModel.selector, toolId, modelId));
        registry.getLatestResult(toolId, modelId);
    }

    // ===== Batch Benchmark =====

    function test_batchRecordBenchmarkRuns() public {
        _registerTool(toolId, clusterId);

        bytes32 modelId2 = keccak256(abi.encodePacked("gpt-4o"));
        bytes32[] memory modelIds = new bytes32[](2);
        modelIds[0] = modelId;
        modelIds[1] = modelId2;

        uint8[] memory invokeRates = new uint8[](2);
        invokeRates[0] = 85; invokeRates[1] = 72;
        uint8[] memory mentionRates = new uint8[](2);
        mentionRates[0] = 70; mentionRates[1] = 65;
        uint8[] memory silentRates = new uint8[](2);
        silentRates[0] = 10; silentRates[1] = 15;
        uint8[] memory errorRates = new uint8[](2);
        errorRates[0] = 5; errorRates[1] = 8;
        bool[] memory strictVals = new bool[](2);
        strictVals[0] = true; strictVals[1] = false;
        bool[] memory under128s = new bool[](2);
        under128s[0] = true; under128s[1] = true;

        vm.prank(writer);
        registry.batchRecordBenchmarkRuns(
            toolId, modelIds, invokeRates, mentionRates, silentRates,
            errorRates, strictVals, under128s, "v2"
        );

        assertEq(registry.getToolRunCount(toolId), 2);
        assertEq(registry.getLatestResult(toolId, modelId).invokeRate, 85);
        assertEq(registry.getLatestResult(toolId, modelId2).invokeRate, 72);
    }

    function test_revert_batchRecord_lengthMismatch() public {
        _registerTool(toolId, clusterId);

        bytes32[] memory modelIds = new bytes32[](2);
        uint8[] memory invokeRates = new uint8[](1); // mismatch
        uint8[] memory mentionRates = new uint8[](2);
        uint8[] memory silentRates = new uint8[](2);
        uint8[] memory errorRates = new uint8[](2);
        bool[] memory strictVals = new bool[](2);
        bool[] memory under128s = new bool[](2);

        vm.prank(writer);
        vm.expectRevert(IToolRegistry.ArrayLengthMismatch.selector);
        registry.batchRecordBenchmarkRuns(
            toolId, modelIds, invokeRates, mentionRates, silentRates,
            errorRates, strictVals, under128s, "v2"
        );
    }

    // ===== Pagination =====

    function test_getToolIds_pagination() public {
        bytes32 id1 = keccak256(abi.encode("tool1", "url1"));
        bytes32 id2 = keccak256(abi.encode("tool2", "url2"));
        bytes32 id3 = keccak256(abi.encode("tool3", "url3"));
        _registerTool(id1, clusterId);
        _registerTool(id2, clusterId);
        _registerTool(id3, clusterId);

        bytes32[] memory page1 = registry.getToolIds(0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], id1);
        assertEq(page1[1], id2);

        bytes32[] memory page2 = registry.getToolIds(2, 2);
        assertEq(page2.length, 1);
        assertEq(page2[0], id3);
    }

    function test_getToolIds_outOfBounds() public {
        _registerTool(toolId, clusterId);
        bytes32[] memory result = registry.getToolIds(10, 5);
        assertEq(result.length, 0);
    }

    function test_getClusterToolsPaginated() public {
        bytes32 id1 = keccak256(abi.encode("tool1", "url1"));
        bytes32 id2 = keccak256(abi.encode("tool2", "url2"));
        _registerTool(id1, clusterId);
        _registerTool(id2, clusterId);

        bytes32[] memory page = registry.getClusterToolsPaginated(clusterId, 0, 1);
        assertEq(page.length, 1);
        assertEq(page[0], id1);

        bytes32[] memory page2 = registry.getClusterToolsPaginated(clusterId, 1, 5);
        assertEq(page2.length, 1);
        assertEq(page2[0], id2);
    }

    // ===== Helpers =====

    function test_computeToolId_collisionResistant() public view {
        // These would collide with abi.encodePacked but not with abi.encode
        bytes32 id1 = registry.computeToolId("ab", "cd");
        bytes32 id2 = registry.computeToolId("a", "bcd");
        assertTrue(id1 != id2);
    }

    function test_computeToolId() public view {
        bytes32 computed = registry.computeToolId("swap_tokens", "https://mcp.example.com/swap");
        assertEq(computed, keccak256(abi.encode("swap_tokens", "https://mcp.example.com/swap")));
    }

    function test_computeModelId() public view {
        bytes32 computed = registry.computeModelId("claude-4.6");
        assertEq(computed, keccak256(abi.encodePacked("claude-4.6")));
    }

    function test_computeClusterId() public view {
        bytes32 computed = registry.computeClusterId("dex_swap");
        assertEq(computed, keccak256(abi.encodePacked("dex_swap")));
    }

    // ===== Events =====

    function test_emit_ToolRegistered() public {
        vm.prank(writer);
        vm.expectEmit(true, true, false, true);
        emit IToolRegistry.ToolRegistered(toolId, clusterId, writer);
        registry.registerTool(toolId, clusterId, 10, 0, 3, 5, 2, true, "uri", bytes32(0));
    }

    function test_emit_BenchmarkRecorded() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        vm.expectEmit(true, true, false, true);
        emit IToolRegistry.BenchmarkRecorded(toolId, modelId, 1, 85);
        registry.recordBenchmarkRun(toolId, modelId, 85, 70, 10, 5, true, true, "v2");
    }

    function test_emit_ToolDeactivated() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        vm.expectEmit(true, false, false, true);
        emit IToolRegistry.ToolDeactivated(toolId);
        registry.deactivateTool(toolId);
    }

    function test_emit_ToolReactivated() public {
        _registerTool(toolId, clusterId);
        vm.prank(writer);
        registry.deactivateTool(toolId);
        vm.prank(writer);
        vm.expectEmit(true, false, false, true);
        emit IToolRegistry.ToolReactivated(toolId);
        registry.reactivateTool(toolId);
    }

    // ===== UUPS Upgrade =====

    function test_upgrade_byAdmin() public {
        AAORegistry newImpl = new AAORegistry();
        registry.upgradeToAndCall(address(newImpl), "");
        _registerTool(toolId, clusterId);
        assertEq(registry.totalTools(), 1);
    }

    function test_revert_upgrade_byNonAdmin() public {
        AAORegistry newImpl = new AAORegistry();
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.upgradeToAndCall(address(newImpl), "");
    }

    // ===== Implementation cannot be initialized directly =====

    function test_revert_initializeImplementation() public {
        vm.expectRevert();
        implementation.initialize(address(0x99));
    }

    // ===== Call Records =====

    function test_recordCall() public {
        _registerTool(toolId, clusterId);

        bytes32 crHash = keccak256(abi.encodePacked("cr_20260320_xyz789"));
        address agent = address(0xA1);

        vm.prank(writer);
        registry.recordCall(crHash, toolId, agent, true);

        assertTrue(registry.verifyCallRecord(crHash));

        IToolRegistry.CallRecord memory cr = registry.getCallRecord(crHash);
        assertEq(cr.toolId, toolId);
        assertEq(cr.agentWallet, agent);
        assertTrue(cr.success);
        assertTrue(cr.exists);
    }

    function test_recordCall_failedCall() public {
        _registerTool(toolId, clusterId);

        bytes32 crHash = keccak256(abi.encodePacked("cr_20260320_fail001"));
        address agent = address(0xA2);

        vm.prank(writer);
        registry.recordCall(crHash, toolId, agent, false);

        IToolRegistry.CallRecord memory cr = registry.getCallRecord(crHash);
        assertFalse(cr.success);
    }

    function test_recordCall_indexesByToolAndAgent() public {
        _registerTool(toolId, clusterId);

        address agent = address(0xA1);
        bytes32 crHash1 = keccak256(abi.encodePacked("cr_001"));
        bytes32 crHash2 = keccak256(abi.encodePacked("cr_002"));

        vm.prank(writer);
        registry.recordCall(crHash1, toolId, agent, true);
        vm.prank(writer);
        registry.recordCall(crHash2, toolId, agent, true);

        bytes32[] memory toolCrs = registry.getToolCallRecords(toolId);
        assertEq(toolCrs.length, 2);
        assertEq(toolCrs[0], crHash1);
        assertEq(toolCrs[1], crHash2);

        bytes32[] memory agentCrs = registry.getAgentCallRecords(agent);
        assertEq(agentCrs.length, 2);
    }

    function test_revert_recordCall_toolNotFound() public {
        bytes32 crHash = keccak256(abi.encodePacked("cr_xxx"));
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.ToolNotFound.selector, toolId));
        registry.recordCall(crHash, toolId, address(0xA1), true);
    }

    function test_revert_recordCall_duplicate() public {
        _registerTool(toolId, clusterId);
        bytes32 crHash = keccak256(abi.encodePacked("cr_dup"));

        vm.prank(writer);
        registry.recordCall(crHash, toolId, address(0xA1), true);

        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.CallRecordAlreadyExists.selector, crHash));
        registry.recordCall(crHash, toolId, address(0xA1), true);
    }

    function test_revert_recordCall_unauthorized() public {
        _registerTool(toolId, clusterId);
        bytes32 crHash = keccak256(abi.encodePacked("cr_unauth"));

        vm.prank(unauthorized);
        vm.expectRevert();
        registry.recordCall(crHash, toolId, address(0xA1), true);
    }

    function test_verifyCallRecord_nonexistent() public view {
        bytes32 crHash = keccak256(abi.encodePacked("cr_nonexistent"));
        assertFalse(registry.verifyCallRecord(crHash));
    }

    function test_revert_getCallRecord_notFound() public {
        bytes32 crHash = keccak256(abi.encodePacked("cr_notfound"));
        vm.expectRevert(abi.encodeWithSelector(IToolRegistry.CallRecordNotFound.selector, crHash));
        registry.getCallRecord(crHash);
    }

    function test_computeCallRecordHash() public view {
        bytes32 computed = registry.computeCallRecordHash("cr_20260320_xyz789");
        assertEq(computed, keccak256(abi.encodePacked("cr_20260320_xyz789")));
    }

    function test_computeCallRecordHash_matchesZianFormat() public view {
        // Zian uses: keccak256(call_record_id UTF-8 bytes)
        // We must produce the same hash
        string memory callRecordId = "cr_20260320_xyz789";
        bytes32 ourHash = registry.computeCallRecordHash(callRecordId);
        bytes32 zianHash = keccak256(bytes(callRecordId));
        assertEq(ourHash, zianHash);
    }

    function test_emit_CallRecorded() public {
        _registerTool(toolId, clusterId);
        bytes32 crHash = keccak256(abi.encodePacked("cr_evt"));
        address agent = address(0xA1);

        vm.prank(writer);
        vm.expectEmit(true, true, true, true);
        emit IToolRegistry.CallRecorded(crHash, toolId, agent, true);
        registry.recordCall(crHash, toolId, agent, true);
    }

    function test_version_updated() public view {
        assertEq(keccak256(bytes(registry.VERSION())), keccak256(bytes("3.2.0")));
    }
}
