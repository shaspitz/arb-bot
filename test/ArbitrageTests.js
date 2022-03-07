const { expect } = require("chai");
const { ethers } = require("hardhat");
const config = require('../config.json');
const { setupAndManipulatePrice } = require("../helpers/localPriceManipulator");

// From: https://hardhat.org/tutorial/debugging-with-hardhat-network.html
// Hardhat comes built-in with Hardhat Network, a local Ethereum network
// designed for development. It allows you to deploy your contracts,
// run your tests and debug your code. It's the default network Hardhat connects to,
// so you don't need to setup anything for it to work. Just run your tests.

describe("Arbitrage contract", async function () {
  it("Test token to market Id mapping.", async function () {
    // Use contract factory instead of instantiating ethers.Contract object,
    // since the relevant contract is not already deployed.
    // Note: real deploys should use contract factory constructor instead of "getContractFactory". 

    const flashLoanContract = await ethers.getContractFactory("Arbitrage");
    
    // With hardhat-ethers plugin, contract is deployed to first signer by default.
    const deployedContract = await flashLoanContract.deploy(
      config.SUSHISWAP.V2_ROUTER_02_ADDRESS, 
      config.UNISWAP.V2_ROUTER_02_ADDRESS
    );
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const marketId = await deployedContract.getMarketId(wethAddress);
    expect(marketId).to.equal(0);
  });

  before(async function () {
  })

  it("Test arb opportunity execution.", async function() {
    // Assumes that uniswap price is manipulated, then we have an arb opportunity.
    const {priceBefore, priceAfter} = await setupAndManipulatePrice();


  })
});

// ! It may be less beneficial to simulate swap events in sim than you thought..
// ! You could instead just run the contract on mainnet and try out different params
// ! Maybe both methods of testing are useful? 