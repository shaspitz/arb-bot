const { expect } = require("chai");
const config = require("../config.json");
const { ChainId, Token, WETH } = require("@uniswap/sdk");
const { abi: erc20Abi } = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const { ethers } = require("hardhat");
const { manipulatePrice } = require("../scripts/localPriceManipulator");

// From: https://hardhat.org/tutorial/debugging-with-hardhat-network.html
// Hardhat comes built-in with Hardhat Network, a local Ethereum network
// designed for development. It allows you to deploy your contracts,
// run your tests and debug your code. It's the default network Hardhat connects to,
// so you don't need to setup anything for it to work. Just run your tests.

const UNLOCKED_ACCOUNT = "0x0e5069514a3Dd613350BAB01B58FD850058E5ca4"; // SHIB Unlocked Account.
// const wallet = new ethers.Wallet(UNLOCKED_ACCOUNT); 

let wallet,
signers,
erc20Contract,
uniSwapFactory,
sushiSwapFactory,
uniSwapRouter,
sushiSwapRouter;

beforeEach(async function () {
  signers = await ethers.getSigners();

  const erc20Address = process.env.ARB_AGAINST;
  erc20Contract = new ethers.Contract(erc20Address, erc20Abi, signers[1]);
  // uniSwapFactory = await ethers.getContractAt(IUniswapV2Factory.abi, config.UNISWAP.FACTORY_ADDRESS, wallet);
  // sushiSwapFactory = await ethers.getContractAt(IUniswapV2Factory.abi, config.SUSHISWAP.FACTORY_ADDRESS, wallet);
  uniSwapRouter = new ethers.Contract(config.UNISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, signers[1]);
  // sushiSwapRouter = await ethers.getContractAt(IUniswapV2Router02.abi, config.SUSHISWAP.V2_ROUTER_02_ADDRESS, wallet);
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
    
    // const token = new Token( // From uniswap sdk.
    //   ChainId.MAINNET,
    //   erc20Address,
    //   18, // 18 decimal token.
    //   await erc20Contract.symbol(),
    //   await erc20Contract.name(),
    // );

    let signer = signers[1]; // ! 0? 

    // Hardhat's method of impersonating a whale account. See https://hardhat.org/hardhat-network/reference/#hardhat-impersonateaccount.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x72a53cdbbcc1b9efa39c834a540550e23463aacb"],
    });

    // TODO: lots o cleanup here. you know how to do 3 things tho.

    // 1. impersonate account, 2. connect to on chain contracts, 3. deploy your own contracts

    signer = await ethers.getSigner(
      "0x72a53cdbbcc1b9efa39c834a540550e23463aacb"
    );

    const erc20Address = process.env.ARB_AGAINST;
    erc20Contract = new ethers.Contract(erc20Address, erc20Abi, signer);
    uniSwapRouter = new ethers.Contract(config.UNISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, signer);

    // const wallet = new ethers.Wallet();
    const test = await manipulatePrice(erc20Contract, uniSwapRouter, signer);

    // TODO: Test local net price manipulation. 
  })
})
