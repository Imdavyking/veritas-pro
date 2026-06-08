# Veritas — Autonomous Prediction Market

> Every market is created, resolved, and disputed by on-chain AI agents.
> Zero human admins. Zero manual oracles.

Built for the **Somnia Agentathon** — [encodeclub.com/programmes/agentathon](https://www.encodeclub.com/programmes/agentathon)

---

## Project structure

```
veritas/
├── contract/                     ← Hardhat project
│   ├── contracts/
│   │   ├── interfaces/
│   │   │   └── ISomniaAgents.sol ← Somnia platform + agent interfaces
│   │   ├── VeritasMarket.sol     ← Core contract
│   │   └── MockPlatform.sol      ← Test helper
│   ├── scripts/
│   │   └── deploy.js             ← Deploy to testnet/mainnet
│   ├── test/
│   │   └── Veritas.test.js       ← Hardhat tests
│   ├── hardhat.config.js
│   ├── package.json
│   └── .env.example
│
└── frontend/                     ← Vite + React app
    ├── src/
    │   ├── config/
    │   │   └── contract.js       ← ABI + addresses
    │   ├── hooks/
    │   │   ├── useWallet.js      ← MetaMask connection
    │   │   └── useMarkets.js     ← Contract reads + writes
    │   ├── components/
    │   │   ├── ui.jsx            ← Shared UI primitives
    │   │   ├── MarketCard.jsx    ← Market list card
    │   │   ├── MarketDetail.jsx  ← Bet, resolve, dispute, claim
    │   │   └── CreateMarket.jsx  ← New market form
    │   ├── App.jsx               ← Root, routing, wallet
    │   ├── main.jsx              ← React entry
    │   └── index.css             ← Global styles + CSS vars
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── .env.example
```

---

## Quickstart

### 1 — Contract

```bash
cd contract
npm install
cp .env.example .env        # add PRIVATE_KEY
npm run compile
npm run test
npm run deploy:testnet
```

Get testnet STT: [somnia.network/faucet](https://somnia.network/faucet)

Fund the deployed contract with STT for agent fees:

```bash
cast send <CONTRACT_ADDRESS> --value 5ether \
  --private-key $PRIVATE_KEY \
  --rpc-url https://dream-rpc.somnia.network
```

### 2 — Frontend

```bash
cd frontend
npm install
cp .env.example .env        # add VITE_CONTRACT_ADDRESS from deploy output
npm run dev                 # http://localhost:5173
```

---

## How Veritas works

```
User proposes question
       ↓
createMarket() → deployed on-chain (status: Open)
       ↓  [users bet YES/NO with STT]
deadline passes
       ↓
triggerResolution() → LLM Parse Website agent dispatched
       ↓  [3 validators execute independently]
consensus reached → handleResponse() callback fires
       ↓
outcome written on-chain + receiptHash (status: Resolved)
       ↓  [2h dispute window]
claimPayout() → winners receive proportional share
```

Dispute path: `raiseDispute()` → LLM Inference re-examines → second verdict may override.

---

## Somnia agents used

| Agent             | ID                     | Cost/validator | Role                                             |
| ----------------- | ---------------------- | -------------- | ------------------------------------------------ |
| LLM Parse Website | `12875401142070969085` | 0.10 STT       | Reads resolution source, extracts yes/no         |
| LLM Inference     | `12847293847561029384` | 0.07 STT       | Re-examines verdict on dispute (stricter prompt) |

Resolution fee: `getRequestDeposit() + 0.10 × 3 STT ≈ 0.33 STT`
Dispute fee: `getRequestDeposit() + 0.07 × 3 STT ≈ 0.24 STT`

---

## Network

|                |                                              |
| -------------- | -------------------------------------------- |
| Chain          | Somnia Testnet                               |
| Chain ID       | 50312                                        |
| RPC            | https://dream-rpc.somnia.network             |
| Explorer       | https://shannon-explorer.somnia.network      |
| Platform       | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| Agent explorer | https://agents.testnet.somnia.network/       |

---

## Demo flow (for judges)

1. Open frontend → **connect wallet** (MetaMask on Somnia testnet)
2. Click **+ create** → enter a live question, e.g. _"Will ETH close above $3,500 today?"_ with source `coinmarketcap.com`
3. Set deadline 5 minutes from now → **deploy market**
4. Bet YES or NO with small STT amounts
5. After deadline → click **trigger resolution**
6. Watch the agent log stream in real time (Parse Website → consensus → callback)
7. Show the **receipt hash** on-chain — proof of what was scraped and what the model returned
8. Click **claim payout** — funds distributed automatically, no human involved

Total time: **~30 seconds on testnet** from trigger to payout.

---

## Business model

| Revenue source | Rate                       |
| -------------- | -------------------------- |
| Protocol fee   | 1% of resolved market pool |

At $1M daily volume → $10k/day revenue. Agent cost per resolution ~$0.33 STT.
