// src/config/contract.js
// ─────────────────────────────────────────────────────────────
//  Contract addresses, chain config, and ABI
// ─────────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

// Numeric chainId — use this for comparisons in JS
export const SOMNIA_CHAIN_ID = 50312;

// Hex chainId — only used in wallet_switchEthereumChain params
export const SOMNIA_CHAIN_ID_HEX = "0xC488"; // 50312 in hex

// Passed to wallet_addEthereumChain.
// MUST NOT contain extra keys — MetaMask rejects unknown fields (e.g. chainIdHex).
// chainId field here must be the hex string per EIP-3085.
export const SOMNIA_ADD_CHAIN_PARAMS = {
  chainId: SOMNIA_CHAIN_ID_HEX,
  chainName: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: ["https://dream-rpc.somnia.network"],
  blockExplorerUrls: ["https://shannon-explorer.somnia.network"],
};

export const VERITAS_ABI = [
  // ── Read ──────────────────────────────────────────────────
  "function marketCount() view returns (uint256)",
  "function getMarket(uint256 id) view returns (tuple(string question, string resolutionSource, uint256 deadline, uint256 yesPool, uint256 noPool, uint8 outcome, uint8 status, uint256 resolveRequestId, uint256 disputeRequestId, uint256 disputeDeadline, address creator))",
  "function getStakes(uint256 id, address user) view returns (uint256 yes, uint256 no)",
  "function claimed(uint256, address) view returns (bool)",
  "function resolutionFee() view returns (uint256)",
  "function disputeFee() view returns (uint256)",
  "function feeRecipient() view returns (address)",

  // ── Write ─────────────────────────────────────────────────
  "function createMarket(string question, string resolutionSource, uint256 deadline) returns (uint256 id)",
  "function betYes(uint256 id) payable",
  "function betNo(uint256 id) payable",
  "function triggerResolution(uint256 id) payable",
  "function raiseDispute(uint256 id) payable",
  "function claimPayout(uint256 id)",

  // ── Events ────────────────────────────────────────────────
  "event MarketCreated(uint256 indexed id, address indexed creator, string question, string resolutionSource, uint256 deadline)",
  "event BetPlaced(uint256 indexed id, address indexed bettor, bool isYes, uint256 amount)",
  "event ResolutionTriggered(uint256 indexed id, uint256 requestId, address triggeredBy)",
  "event MarketResolved(uint256 indexed id, uint8 outcome, bytes32 receiptHash, bool wasDisputed)",
  "event DisputeRaised(uint256 indexed id, uint256 requestId, address raisedBy)",
  "event PayoutClaimed(uint256 indexed id, address indexed winner, uint256 amount, uint256 fee)",
];

// Enum maps
export const MARKET_STATUS = [
  "Open",
  "PendingResolve",
  "Resolved",
  "Disputed",
  "Cancelled",
];
export const MARKET_OUTCOME = ["Unset", "Yes", "No"];
