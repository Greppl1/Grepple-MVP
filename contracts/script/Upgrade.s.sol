// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/AAORegistry.sol";

/// @notice Deploys a new AAORegistry implementation and upgrades the existing proxy.
contract UpgradeAAORegistry is Script {
    function run() external {
        // Current proxy address (V3.1)
        address proxy = 0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01;

        vm.startBroadcast();

        // 1. Deploy new implementation
        AAORegistry newImpl = new AAORegistry();
        console.log("New implementation deployed at:", address(newImpl));

        // 2. Upgrade proxy to new implementation (no re-initialization needed)
        AAORegistry(proxy).upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded. VERSION:", AAORegistry(proxy).VERSION());

        vm.stopBroadcast();
    }
}
