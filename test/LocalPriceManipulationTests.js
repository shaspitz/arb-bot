const { expect } = require("chai");
const config = require("../config.json");
const { abi: erc20Abi } = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const { ethers } = require("hardhat");
const { resetHardhatToFork } = require("../helpers/generalHelpers");
const { manipulatePrice, AMOUNT, ACCOUNT_TO_IMPERSONATE,
    impersonateWhaleAccount, setupAndManipulatePrice, } = require("../helpers/localPriceManipulator");

let
signer,
erc20Contract,
uniSwapRouter;

describe("Price manipulation methods.", async function () {
    beforeEach(async function () {
        await resetHardhatToFork();
        signer = await impersonateWhaleAccount();
        erc20Contract = new ethers.Contract(process.env.ARB_AGAINST, erc20Abi, signer);
        uniSwapRouter = new ethers.Contract(config.UNISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, signer);
      })
    
    it("Dex transaction is successful for the manipulate price method.", async function () {

        const balanceBefore = await erc20Contract.balanceOf(signer.address);
        const receipt = await manipulatePrice(erc20Contract, uniSwapRouter, signer.address, AMOUNT);
        const balanceAfter = await erc20Contract.balanceOf(signer.address);

        expect(receipt).to.not.be.null;
        expect(receipt).to.not.be.undefined;
        expect(receipt.from.toLowerCase()).to.equal(ACCOUNT_TO_IMPERSONATE);

        // Check expected value as number, toString causes overflow error.
        const diff = balanceBefore - balanceAfter;
        const amountInSmallestDecimal = ethers.utils.parseUnits(AMOUNT.toString(), "ether"); 
        expect(diff).to.be.greaterThanOrEqual(Number(amountInSmallestDecimal));
    });

    it("Local price manipulation is sane and actually creates an arb opportunity", async function () {
        const wEthContract = new ethers.Contract(process.env.ARB_FOR, erc20Abi, signer);

        // Starting prices.
        const [startingShib, startingWEth] = await Promise.all([
            erc20Contract.balanceOf(signer.address),
            wEthContract.balanceOf(signer.address)
        ]);

        const {priceBefore, priceAfter} = await setupAndManipulatePrice(AMOUNT);

        // We're dumping SHIB, so WETH/SHIB price should go up.
        priceMultiplier = priceAfter / priceBefore;
        console.log("Price multiplier from dumping SHIB", priceMultiplier);
        expect(priceMultiplier).to.be.greaterThan(1.5);

        // Avg execution price vs starting price. 
        const [endingShib, endingWEth] = await Promise.all([
            erc20Contract.balanceOf(signer.address),
            wEthContract.balanceOf(signer.address)
        ]);
        const shibLost = startingShib - endingShib;
        const wEthGained = endingWEth - startingWEth;
        const averageExecutionPrice = shibLost / wEthGained;

        // Slippage!
        console.log("Starting price (SHIB/WETH): ", priceBefore);
        console.log("Average swap price (SHIB/WETH): ", averageExecutionPrice);
    });
});