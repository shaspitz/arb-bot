const { expect } = require("chai");
const config = require("../config.json");
const { abi: erc20Abi } = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const { ethers } = require("hardhat");
const { manipulatePrice, AMOUNT, setupAndManipulatePrice } = require("../helpers/localPriceManipulator");

const accountToImpersonate = "0x72a53cdbbcc1b9efa39c834a540550e23463aacb";  
let
signer,
erc20Contract,
uniSwapRouter;

before(async function () {
    // Hardhat's method of impersonating a whale account. See https://hardhat.org/hardhat-network/reference/#hardhat-impersonateaccount.
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [accountToImpersonate],
    });
    signer = await ethers.getSigner(accountToImpersonate);
    erc20Contract = new ethers.Contract(process.env.ARB_AGAINST, erc20Abi, signer);
    uniSwapRouter = new ethers.Contract(config.UNISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, signer);
})

describe("Manipulate price method.", async function () { 
    it("Dex transaction is successful for the manipulate price method.", async function () {

        const balanceBefore = await erc20Contract.balanceOf(signer.address);
        const receipt = await manipulatePrice(erc20Contract, uniSwapRouter, signer);
        const balanceAfter = await erc20Contract.balanceOf(signer.address);

        expect(receipt).to.not.be.null;
        expect(receipt).to.not.be.undefined;
        expect(receipt.from.toLowerCase()).to.equal(accountToImpersonate);

        // Check expected value as number, toString causes overflow error.
        const diff = balanceBefore - balanceAfter;
        const amountInSmallestDecimal = ethers.utils.parseUnits(AMOUNT.toString(), "ether"); 
        expect(diff).to.equal(Number(amountInSmallestDecimal));
    });
});

describe("Entire setup and module for price manipulation.", async function () { 
    it("Local price manipulation is sane and actually creates an arb opportunity", async function () {
        const test = setupAndManipulatePrice();
    });
});