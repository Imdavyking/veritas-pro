// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────
//  Veritas — Autonomous Prediction Market
//  ─────────────────────────────────────────────────────────────
//  Every market is created, resolved, and disputed by on-chain
//  AI agents running on Somnia's Agentic L1.
//  Zero human admins. Zero manual oracles.
//
//  Resolution flow:
//    1. createMarket()        — set question, source, deadline
//    2. betYes() / betNo()    — stake STT before deadline
//    3. triggerResolution()   — dispatches LLM Parse Website agent
//    4. handleResponse()      — platform callback writes outcome
//    5. claimPayout()         — winners receive proportional share
//
//  Dispute flow (within 2h of resolution):
//    raiseDispute()           — dispatches LLM Inference agent
//    handleResponse()         — second verdict may override first
//
//  Deploy: constructor(PLATFORM_ADDRESS, FEE_RECIPIENT)
//  Fund:   send STT to contract address before calling anything
// ─────────────────────────────────────────────────────────────

import "./interfaces/ISomniaAgents.sol";

contract Veritas is IAgentRequesterHandler {
    // ─── Platform ────────────────────────────────────────────────

    /// Somnia platform contract (set in constructor).
    /// Testnet:  0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776
    /// Mainnet:  see docs.somnia.network/agents
    IAgentRequester public immutable platform;

    // ─── Agent IDs (identical on testnet + mainnet) ───────────────

    uint256 public constant AGENT_LLM_PARSE = 12875401142070969085;
    uint256 public constant AGENT_LLM_INFER = 12847293847561029384;

    // ─── Cost constants ───────────────────────────────────────────

    /// Price per validator for LLM Parse Website (0.10 STT)
    uint256 public constant COST_PARSE = 0.10 ether;
    /// Price per validator for LLM Inference (0.07 STT)
    uint256 public constant COST_INFER = 0.07 ether;
    /// Default subcommittee size (3 validators reach consensus)
    uint256 public constant SUBCOMMITTEE = 3;

    // ─── Protocol fee ─────────────────────────────────────────────

    /// 1% of total pool taken on winning payout (100 bps)
    uint256 public constant FEE_BPS = 100;
    address public immutable feeRecipient;

    // ─── Types ────────────────────────────────────────────────────

    enum MarketStatus {
        Open, // accepting bets
        PendingResolve, // resolution agent request in-flight
        Resolved, // outcome committed, payouts available
        Disputed, // dispute agent request in-flight
        Cancelled // unrecoverable failure state
    }

    enum Outcome {
        Unset,
        Yes,
        No
    }

    struct Market {
        string question; // "Will ETH > $3500 at midnight UTC?"
        string resolutionSource; // domain hint: "coinmarketcap.com"
        uint256 deadline; // unix timestamp — bets close, resolution opens
        uint256 yesPool; // total STT staked YES (wei)
        uint256 noPool; // total STT staked NO  (wei)
        Outcome outcome;
        MarketStatus status;
        uint256 resolveRequestId;
        uint256 disputeRequestId;
        uint256 disputeDeadline; // 2h window after resolution
        address creator;
    }

    // ─── Storage ──────────────────────────────────────────────────

    uint256 public marketCount;

    mapping(uint256 => Market) public markets;

    /// marketId => user => amount staked YES (wei)
    mapping(uint256 => mapping(address => uint256)) public yesStakes;
    /// marketId => user => amount staked NO  (wei)
    mapping(uint256 => mapping(address => uint256)) public noStakes;
    /// requestId => marketId (for callback routing)
    mapping(uint256 => uint256) private _requestMarket;
    /// requestId => true if this is a dispute (not initial resolution)
    mapping(uint256 => bool) private _requestIsDispute;
    /// marketId => user => has claimed payout
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ─── Events ───────────────────────────────────────────────────

    event MarketCreated(
        uint256 indexed id,
        address indexed creator,
        string question,
        string resolutionSource,
        uint256 deadline
    );

    event BetPlaced(
        uint256 indexed id,
        address indexed bettor,
        bool isYes,
        uint256 amount
    );

    event ResolutionTriggered(
        uint256 indexed id,
        uint256 requestId,
        address triggeredBy
    );

    event MarketResolved(
        uint256 indexed id,
        Outcome outcome,
        bytes32 receiptHash,
        bool wasDisputed
    );

    event DisputeRaised(
        uint256 indexed id,
        uint256 requestId,
        address raisedBy
    );

    event PayoutClaimed(
        uint256 indexed id,
        address indexed winner,
        uint256 amount,
        uint256 fee
    );

    // ─── Errors ───────────────────────────────────────────────────

    error NotOpen();
    error DeadlineNotPassed();
    error DeadlineInPast();
    error BettingClosed();
    error ZeroBet();
    error InsufficientFee();
    error NotPlatform();
    error UnknownRequest();
    error NotResolved();
    error DisputeWindowClosed();
    error DisputeWindowOpen();
    error AlreadyClaimed();
    error NoWinningStake();
    error EmptyQuestion();

    // ─── Constructor ──────────────────────────────────────────────

    constructor(address platform_, address feeRecipient_) {
        platform = IAgentRequester(platform_);
        feeRecipient = feeRecipient_;
    }

    // ─── Market creation ──────────────────────────────────────────

    /// @notice Create a new prediction market.
    /// @param question         The yes/no question to resolve.
    /// @param resolutionSource Domain hint for the Parse Website agent
    ///                         e.g. "coinmarketcap.com", "apnews.com"
    /// @param deadline         Unix timestamp — bets close, resolution opens.
    function createMarket(
        string calldata question,
        string calldata resolutionSource,
        uint256 deadline
    ) external returns (uint256 id) {
        if (bytes(question).length == 0) revert EmptyQuestion();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        id = marketCount++;

        markets[id] = Market({
            question: question,
            resolutionSource: resolutionSource,
            deadline: deadline,
            yesPool: 0,
            noPool: 0,
            outcome: Outcome.Unset,
            status: MarketStatus.Open,
            resolveRequestId: 0,
            disputeRequestId: 0,
            disputeDeadline: 0,
            creator: msg.sender
        });

        emit MarketCreated(
            id,
            msg.sender,
            question,
            resolutionSource,
            deadline
        );
    }

    // ─── Betting ──────────────────────────────────────────────────

    /// @notice Bet YES on market `id`. Send STT as msg.value.
    function betYes(uint256 id) external payable {
        _bet(id, true);
    }

    /// @notice Bet NO on market `id`. Send STT as msg.value.
    function betNo(uint256 id) external payable {
        _bet(id, false);
    }

    function _bet(uint256 id, bool isYes) internal {
        Market storage m = markets[id];
        if (m.status != MarketStatus.Open) revert NotOpen();
        if (block.timestamp >= m.deadline) revert BettingClosed();
        if (msg.value == 0) revert ZeroBet();

        if (isYes) {
            m.yesPool += msg.value;
            yesStakes[id][msg.sender] += msg.value;
        } else {
            m.noPool += msg.value;
            noStakes[id][msg.sender] += msg.value;
        }

        emit BetPlaced(id, msg.sender, isYes, msg.value);
    }

    // ─── Resolution ───────────────────────────────────────────────

    /// @notice Trigger agent resolution after the deadline.
    ///         Dispatches a LLM Parse Website agent call.
    ///         Caller must attach enough STT to cover the agent fee.
    ///         Required: msg.value >= platform.getRequestDeposit() + 0.10 * 3 STT
    function triggerResolution(uint256 id) external payable {
        Market storage m = markets[id];
        if (m.status != MarketStatus.Open) revert NotOpen();
        if (block.timestamp < m.deadline) revert DeadlineNotPassed();

        uint256 fee = _agentFee(COST_PARSE);
        if (msg.value < fee) revert InsufficientFee();

        // Build Parse Website (search mode) payload.
        // Agent searches resolutionSource for news about the question,
        // extracts a single "outcome" field that must be "yes" or "no".
        string[] memory options = new string[](2);
        options[0] = "yes";
        options[1] = "no";
        bytes memory payload = abi.encodeWithSelector(
            ILLMParseWebsiteAgent.ExtractString.selector,
            "outcome", // key
            "Did this prediction come true?", // description
            options, // constrain to yes/no
            string(
                abi.encodePacked(
                    "Has the following prediction come true as of today? ",
                    "Prediction: ",
                    m.question
                )
            ),
            m.resolutionSource, // url/domain
            true, // resolveUrl
            1, // numPages
            2 // confidenceThreshold
        );

        uint256 requestId = platform.createRequest{value: fee}(
            AGENT_LLM_PARSE,
            address(this),
            this.handleResponse.selector,
            payload
        );

        m.status = MarketStatus.PendingResolve;
        m.resolveRequestId = requestId;
        _requestMarket[requestId] = id + 1; // +1 so 0 means unset
        _requestIsDispute[requestId] = false;

        // Refund excess
        uint256 excess = msg.value - fee;
        if (excess > 0) payable(msg.sender).transfer(excess);

        emit ResolutionTriggered(id, requestId, msg.sender);
    }

    // ─── Dispute ──────────────────────────────────────────────────

    /// @notice Raise a dispute within 2h of resolution.
    ///         Dispatches a stricter LLM Inference agent call.
    ///         Required: msg.value >= platform.getRequestDeposit() + 0.07 * 3 STT
    function raiseDispute(uint256 id) external payable {
        Market storage m = markets[id];
        if (m.status != MarketStatus.Resolved) revert NotResolved();
        if (block.timestamp > m.disputeDeadline) revert DisputeWindowClosed();

        uint256 fee = _agentFee(COST_INFER);
        if (msg.value < fee) revert InsufficientFee();

        string[] memory allowed = new string[](2);
        allowed[0] = "yes";
        allowed[1] = "no";

        bytes memory payload = abi.encodeWithSelector(
            ILLMInferenceAgent.inferString.selector,
            string(
                abi.encodePacked(
                    "Prediction: ",
                    m.question,
                    "\nResolution source used: ",
                    m.resolutionSource,
                    "\nCurrent verdict: ",
                    m.outcome == Outcome.Yes ? "yes" : "no",
                    "\nRe-evaluate and return your final answer."
                )
            ),
            "You are an impartial judge reviewing a disputed prediction market resolution. Return only 'yes' if the prediction came true, or 'no' if it did not. Be conservative: uphold the existing verdict unless you find clear evidence to the contrary.",
            false,
            allowed
        );

        uint256 requestId = platform.createRequest{value: fee}(
            AGENT_LLM_INFER,
            address(this),
            this.handleResponse.selector,
            payload
        );

        m.status = MarketStatus.Disputed;
        m.disputeRequestId = requestId;
        _requestMarket[requestId] = id + 1;
        _requestIsDispute[requestId] = true;

        uint256 excess = msg.value - fee;
        if (excess > 0) payable(msg.sender).transfer(excess);

        emit DisputeRaised(id, requestId, msg.sender);
    }

    // ─── Agent callback ───────────────────────────────────────────

    /// @notice Called by the Somnia platform with the agent result.
    ///         Writes the outcome and (if resolved) opens the dispute window.
    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external override {
        if (msg.sender != address(platform)) revert NotPlatform();
        if (_requestMarket[requestId] == 0) revert UnknownRequest();

        uint256 id = _requestMarket[requestId] - 1;
        bool isDispute = _requestIsDispute[requestId];
        Market storage m = markets[id];

        delete _requestMarket[requestId];
        delete _requestIsDispute[requestId];

        // ── Timeout / failure: reset so it can be retried ──
        if (status != ResponseStatus.Success || responses.length == 0) {
            m.status = isDispute ? MarketStatus.Resolved : MarketStatus.Open;
            return;
        }

        // ── Decode verdict ──
        string memory verdict = abi.decode(responses[0].result, (string));
        Outcome newOutcome = _parseVerdict(verdict);

        // Unparseable: reset for retry
        if (newOutcome == Outcome.Unset) {
            m.status = isDispute ? MarketStatus.Resolved : MarketStatus.Open;
            return;
        }

        m.outcome = newOutcome;
        m.status = MarketStatus.Resolved;
        // m.disputeDeadline = block.timestamp + 2 hours; // real timing
        m.disputeDeadline = block.timestamp + 5 minutes; // TESTING for demos

        emit MarketResolved(
            id,
            newOutcome,
            bytes32(responses[0].receipt),
            isDispute
        );
    }

    // ─── Payout ───────────────────────────────────────────────────

    /// @notice Winners call this to claim their proportional share of the pool.
    ///         Can only be called after the 2h dispute window closes.
    function claimPayout(uint256 id) external {
        Market storage m = markets[id];
        if (m.status != MarketStatus.Resolved) revert NotResolved();
        if (block.timestamp <= m.disputeDeadline) revert DisputeWindowOpen();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();

        uint256 stake;
        uint256 winPool;
        uint256 totalPool = m.yesPool + m.noPool;

        if (m.outcome == Outcome.Yes) {
            stake = yesStakes[id][msg.sender];
            winPool = m.yesPool;
        } else {
            stake = noStakes[id][msg.sender];
            winPool = m.noPool;
        }

        if (stake == 0) revert NoWinningStake();
        claimed[id][msg.sender] = true;

        // Proportional payout from total pool, minus 1% protocol fee
        uint256 gross = (stake * totalPool) / winPool;
        uint256 fee = (gross * FEE_BPS) / 10_000;
        uint256 payout = gross - fee;

        if (fee > 0) payable(feeRecipient).transfer(fee);
        payable(msg.sender).transfer(payout);

        emit PayoutClaimed(id, msg.sender, payout, fee);
    }

    // ─── Views ────────────────────────────────────────────────────

    /// @notice Return full market data in one call.
    function getMarket(uint256 id) external view returns (Market memory) {
        return markets[id];
    }

    /// @notice Return a user's stakes on both sides of a market.
    function getStakes(
        uint256 id,
        address user
    ) external view returns (uint256 yes, uint256 no) {
        return (yesStakes[id][user], noStakes[id][user]);
    }

    /// @notice Return the STT fee required for triggerResolution().
    function resolutionFee() external view returns (uint256) {
        return _agentFee(COST_PARSE);
    }

    /// @notice Return the STT fee required for raiseDispute().
    function disputeFee() external view returns (uint256) {
        return _agentFee(COST_INFER);
    }

    // ─── Internal helpers ─────────────────────────────────────────

    function _agentFee(
        uint256 pricePerValidator
    ) internal view returns (uint256) {
        return platform.getRequestDeposit() + pricePerValidator * SUBCOMMITTEE;
    }

    function _parseVerdict(string memory v) internal pure returns (Outcome) {
        bytes32 h = keccak256(bytes(v));
        if (h == keccak256(bytes("yes"))) return Outcome.Yes;
        if (h == keccak256(bytes("no"))) return Outcome.No;
        return Outcome.Unset;
    }

    // ─── Receive STT to fund agent fees ───────────────────────────

    receive() external payable {}
}
