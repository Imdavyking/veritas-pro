// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ISomniaAgents.sol";

/// @dev Minimal mock of the Somnia platform for local Hardhat testing.
///      Does NOT run agents — lets you fire handleResponse manually.
contract MockPlatform {
    uint256 private _nextId = 1;

    struct Stored {
        uint256 agentId;
        address callbackContract;
        bytes4  callbackSelector;
        bytes   payload;
    }

    mapping(uint256 => Stored) public requests;

    function getRequestDeposit() external pure returns (uint256) {
        return 0; // simplified for testing
    }

    function createRequest(
        uint256 agentId,
        address callbackContract,
        bytes4  callbackSelector,
        bytes   calldata payload
    ) external payable returns (uint256 requestId) {
        requestId = _nextId++;
        requests[requestId] = Stored(agentId, callbackContract, callbackSelector, payload);
    }

    /// Manually fire a Success callback with a given verdict string.
    function fireCallback(uint256 requestId, string calldata verdict) external {
        Stored memory s = requests[requestId];
        require(s.callbackContract != address(0), "Unknown request");

        Response[] memory responses = new Response[](1);
        responses[0] = Response({
            result:      abi.encode(verdict),
            receiptHash: keccak256(abi.encodePacked(requestId, verdict))
        });

        Request memory req = Request({
            agentId:          s.agentId,
            callbackContract: s.callbackContract,
            callbackSelector: s.callbackSelector,
            payload:          s.payload
        });

        (bool ok,) = s.callbackContract.call(
            abi.encodeWithSelector(
                s.callbackSelector,
                requestId,
                responses,
                ResponseStatus.Success,
                req
            )
        );
        require(ok, "Callback failed");
    }
}
