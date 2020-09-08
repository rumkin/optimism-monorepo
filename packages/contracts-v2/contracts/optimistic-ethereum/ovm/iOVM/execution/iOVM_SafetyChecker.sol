// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

interface iOVM_SafetyChecker {
    function isBytecodeSafe(bytes memory _bytecode) external returns (bool _safe);
}