const { expect } = require("chai");
const config = require("../config.json");
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const { ethers } = require("hardhat");

// From: https://hardhat.org/tutorial/debugging-with-hardhat-network.html
// Hardhat comes built-in with Hardhat Network, a local Ethereum network
// designed for development. It allows you to deploy your contracts,
// run your tests and debug your code. It's the default network Hardhat connects to,
// so you don't need to setup anything for it to work. Just run your tests.

before(async () => {
  const uniSwapFactory = await ethers.getContractAt(IUniswapV2Factory.abi, config.UNISWAP.FACTORY_ADDRESS);
  const sushiSwapFactory = await ethers.getContractAt(IUniswapV2Factory.abi, config.SUSHISWAP.FACTORY_ADDRESS);
  const uniSwapRouter = await ethers.getContractAt(IUniswapV2Router02.abi, config.UNISWAP.V2_ROUTER_02_ADDRESS);
  const sushiSwapRouter = await ethers.getContractAt(IUniswapV2Router02.abi, config.SUSHISWAP.V2_ROUTER_02_ADDRESS)
})


describe("Arbitrage contract", async function () {
  it("Test token to market Id mapping.", async function () {
    const flashLoanContract = await ethers.getContractFactory("DyDxFlashLoan");
    // With hardhat-ethers plugin, contract is deployed to first signer by default.
    const deployedContract = await flashLoanContract.deploy();
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const marketId = await deployedContract.tokenToMarketId(wethAddress);
    expect(marketId).to.equal(0);
  });
});

describe("Local price manipulator", async function() {
  it("Test local network price manipulation functionality.", async function () {
    // TODO: Test local net price manipulation. 
  })
})
