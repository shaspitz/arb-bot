const { expect } = require("chai");
const config = require("../config.json");

// From: https://hardhat.org/tutorial/debugging-with-hardhat-network.html
// Hardhat comes built-in with Hardhat Network, a local Ethereum network
// designed for development. It allows you to deploy your contracts,
// run your tests and debug your code. It's the default network Hardhat connects to,
// so you don't need to setup anything for it to work. Just run your tests.

before(async () => {
  console.log(config.SUSHISWAP.V2_ROUTER_02_ADDRESS.toString());
  const flashLoanContract = await ethers.getContractFactory(config.SUSHISWAP.FACTORY_ADDRESS);
  console.log("do you need to deploy any other contracts here? What about test net price manipulation? ");
})

describe("Arbitrage contract", function () {
  it("Test token to market Id mapping.", async function () {
    const flashLoanContract = await ethers.getContractFactory("DyDxFlashLoan");
    // With hardhat-ethers plugin, contract is deployed to first signer by default.
    const deployedContract = await flashLoanContract.deploy();
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const marketId = await deployedContract.tokenToMarketId(wethAddress);
    expect(marketId).to.equal(0);
  });
});
