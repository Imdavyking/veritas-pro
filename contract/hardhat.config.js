require("@nomicfoundation/hardhat-toolbox");
require("hardhat-contract-sizer");
require("dotenv").config();

const PK = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },

  networks: {
    hardhat: {},

    "somnia-testnet": {
      url: "https://dream-rpc.somnia.network",
      chainId: 50312,
      accounts: [PK],
      gasPrice: "auto",
    },

    "somnia-mainnet": {
      url: "https://mainnet-rpc.somnia.network",
      chainId: 50311,
      accounts: [PK],
      gasPrice: "auto",
    },
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    strict: true,
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
