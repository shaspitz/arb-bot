const { expect } = require("chai");

// From: https://hardhat.org/tutorial/debugging-with-hardhat-network.html
// Hardhat comes built-in with Hardhat Network, a local Ethereum network
// designed for development. It allows you to deploy your contracts,
// run your tests and debug your code. It's the default network Hardhat connects to,
// so you don't need to setup anything for it to work. Just run your tests.

describe("Arbitrage contract", function () {
  it("test WETH market id, just a start here.", async function () {
    const [owner] = await ethers.getSigners();
    const flashLoanContract = await ethers.getContractFactory("DyDxFlashLoan");
    // With hardhat-ethers plugin, contract is deployed to first signer by default.
    const deployedContract = await flashLoanContract.deploy();
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const marketId = await deployedContract.tokenToMarketId(wethAddress);
    expect(marketId).to.equal(0);
  });
});
