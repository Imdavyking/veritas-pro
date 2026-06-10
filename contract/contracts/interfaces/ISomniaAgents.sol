// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────
//  Somnia Agent Platform — shared types & interfaces
//  Docs:      https://docs.somnia.network/agents
//  Explorer:  https://agents.testnet.somnia.network/
//
//  Platform addresses:
//    Testnet  0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776  (chainId 50312)
//    Mainnet  see docs.somnia.network for latest           (chainId 50311)
//
//  Agent IDs (same on both networks):
//    JSON API Request    13174292974160097713   0.03 STT / validator
//    LLM Inference       12847293847561029384   0.07 STT / validator
//    LLM Parse Website   12875401142070969085   0.10 STT / validator
// ─────────────────────────────────────────────────────────────

// ── Enums / structs shared across all agent calls ─────────────
enum ConsensusType {
    Majority,
    Threshold
}
enum ResponseStatus {
    None, // 0 - Default zero value (uninitialized storage)
    Pending, // 1 - Awaiting responses
    Success, // 2 - Consensus reached normally
    Failed, // 3 - Validators reported failure
    TimedOut // 4 - Request timed out
}

struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}

// ─────────────────────────────────────────────────────────────
//  IAgentRequesterHandler
//  Implement this in your contract to receive agent results.
// ─────────────────────────────────────────────────────────────
interface IAgentRequesterHandler {
    /// Called by the platform when an agent request completes.
    /// @param requestId  ID returned by createRequest()
    /// @param responses  One entry per validator in the subcommittee
    /// @param status     Success | Failed | TimedOut
    /// @param details    Original request params (for audit / routing)
    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory details
    ) external;
}

// ─────────────────────────────────────────────────────────────
//  IAgentRequester
//  The Somnia platform contract. Call createRequest() to
//  dispatch an agent job.
// ─────────────────────────────────────────────────────────────
interface IAgentRequester {
    /// Returns the minimum operations-reserve deposit (wei).
    /// Always add  pricePerAgent × subcommitteeSize  on top.
    /// Deposit formula:
    ///   msg.value >= getRequestDeposit() + pricePerAgent * subcommitteeSize
    function getRequestDeposit() external view returns (uint256);

    /// Dispatches an agent call.
    /// Returns a requestId immediately; result arrives asynchronously
    /// in your handleResponse() callback.
    function createRequest(
        uint256 agentId,
        address callbackContract,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);
}

// ─────────────────────────────────────────────────────────────
//  ILLMParseWebsiteAgent   agentId: 12875401142070969085
//  Scrapes a URL and extracts structured data via LLM.
// ─────────────────────────────────────────────────────────────
interface ILLMParseWebsiteAgent {
    /// Search mode: searches `domain` for content matching `query`,
    /// then extracts the field described by `schema`.
    /// Returns: ABI-encoded string
    function parseWebsiteSearch(
        string calldata domain,
        string calldata query,
        string calldata schema
    ) external returns (string memory);

    function ExtractString(
        string memory key,
        string memory description,
        string[] memory options,
        string memory prompt,
        string memory url,
        bool resolveUrl,
        uint8 numPages,
        uint8 confidenceThreshold
    ) external returns (string memory);

    /// Direct mode: scrapes `url` directly and extracts `schema`.
    /// Returns: ABI-encoded string
    function parseWebsiteDirect(
        string calldata url,
        string calldata schema
    ) external returns (string memory);
}

// ─────────────────────────────────────────────────────────────
//  ILLMInferenceAgent   agentId: 12847293847561029384
//  Deterministic on-chain LLM inference (Qwen3-30B, temp=0).
// ─────────────────────────────────────────────────────────────
interface ILLMInferenceAgent {
    /// Single-turn classification constrained to one of `allowedValues`.
    /// Returns: ABI-encoded string matching one of allowedValues
    function inferString(
        string memory prompt,
        string memory system,
        bool chainOfThought,
        string[] memory allowedValues
    ) external returns (string memory);
}
