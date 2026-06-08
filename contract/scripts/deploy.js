// scripts/deploy.js
// ─────────────────────────────────────────────────────────────
//  Veritas — Deployment script
//  Run: npm run deploy:testnet
//       npm run deploy:mainnet
// ─────────────────────────────────────────────────────────────

require("dotenv").config();
const hre = require("hardhat");

const PLATFORMS = {
  "somnia-testnet": "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
  "somnia-mainnet": "0x0000000000000000000000000000000000000000", // update when live
};

async function main() {
  const network  = hre.network.name;
  const platform = PLATFORMS[network];

  if (!platform || platform === "0x0000000000000000000000000000000000000000") {
    throw new Error(`No platform address configured for network: ${network}`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance    = await deployer.provider.getBalance(deployer.address);

  console.log("─────────────────────────────────────────");
  console.log("  Veritas — Deployment");
  console.log("─────────────────────────────────────────");
  console.log(`  Network:       ${network}`);
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(`  Balance:       ${hre.ethers.formatEther(balance)} STT`);
  console.log(`  Platform:      ${platform}`);

  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  console.log(`  Fee recipient: ${feeRecipient}`);
  console.log("─────────────────────────────────────────");

  const Veritas = await hre.ethers.getContractFactory("Veritas");
  console.log("\n  Deploying Veritas…");

  const veritas = await Veritas.deploy(platform, feeRecipient);
  await veritas.waitForDeployment();

  const address = await veritas.getAddress();
  console.log(`  ✓ Veritas deployed at: ${address}`);

  // ── Next steps ───────────────────────────────────────────

  console.log("\n─────────────────────────────────────────");
  console.log("  Next steps");
  console.log("─────────────────────────────────────────");

  console.log(`
  1. Fund the contract with STT for agent fees:

     cast send ${address} \\
       --value 5ether \\
       --private-key $PRIVATE_KEY \\
       --rpc-url https://dream-rpc.somnia.network

  2. Create your first market (example — ETH price):

     cast send ${address} \\
       "createMarket(string,string,uint256)" \\
       "Will ETH close above 3500 USD today (UTC)?" \\
       "coinmarketcap.com" \\
       $(date -d '+2 hours' +%s) \\
       --private-key $PRIVATE_KEY \\
       --rpc-url https://dream-rpc.somnia.network

  3. Trigger resolution after deadline:

     cast send ${address} \\
       "triggerResolution(uint256)" 0 \\
       --value 0.33ether \\
       --private-key $PRIVATE_KEY \\
       --rpc-url https://dream-rpc.somnia.network

  4. Update frontend/.env:

     VITE_CONTRACT_ADDRESS=${address}
     VITE_CHAIN_ID=50312
  `);

  // ── Optional verification ────────────────────────────────
  if (process.env.VERIFY === "true") {
    console.log("  Verifying on block explorer…");
    await veritas.deploymentTransaction().wait(5);
    await hre.run("verify:verify", {
      address,
      constructorArguments: [platform, feeRecipient],
    });
    console.log("  ✓ Verified");
  }

  return address;
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
