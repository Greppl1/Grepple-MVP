// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/AAORegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Deploys AAORegistry behind a UUPS proxy.
contract DeployAAORegistry is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy implementation
        AAORegistry implementation = new AAORegistry();
        console.log("Implementation deployed at:", address(implementation));

        // 2. Encode initializer call
        bytes memory initData = abi.encodeCall(
            AAORegistry.initialize,
            (msg.sender) // admin = deployer
        );

        // 3. Deploy proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy (use this address) deployed at:", address(proxy));

        vm.stopBroadcast();
    }
}
