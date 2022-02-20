// ! Will need to bug fix this entire file and dependancies.
// Script to manipulate the price of a relevant token pair, to properly test arbitrage opportunities
// in a local dev environment. 

// Imports and config.
require("dotenv").config();
import { UNISWAP, SUSHISWAP } from "../config.json";
import { ChainId, Token, WETH } from "@uniswap/sdk";
const chainId = ChainId.MAINNET;
import { abi as uniSwapRouterAbi } from "@uniswap/v2-periphery/build/IUniswapV2Router02.json";
import { abi as uniSwapFactoryAbi } from "@uniswap/v2-core/build/IUniswapV2Factory.json";
import { abi as erc20Abi } from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { ethers } from "hardhat";
import { getPairContract, calculatePrice } from "../helpers/helpers";
import { formatEther } from "ethers/lib/utils";

// Instantiate contract objects.
// ! Do I need to pass signer into these contracts? 
const uniSwapFactory = await ethers.getContractAt(uniSwapFactoryAbi, UNISWAP.FACTORY_ADDRESS);
const sushiSwapFactory = await ethers.getContractAt(uniSwapFactoryAbi, SUSHISWAP.FACTORY_ADDRESS);
const uniSwapRouter = await ethers.getContractAt(uniSwapRouterAbi, UNISWAP.V2_ROUTER_02_ADDRESS);
const sushiSwapRouter = await ethers.getContractAt(uniSwapRouterAbi, SUSHISWAP.V2_ROUTER_02_ADDRESS);

// Arbitrage will be against given ERC20 token.
// !same signer question here.
const erc20Address = process.env.ARB_AGAINST;
const erc20Contract = await ethers.getContractAt(erc20Abi, erc20Address);
const wEthContract = await ethers.getContractAt(erc20Abi, WETH[chainId].address);

// User config.
const factoryToUse = uniSwapFactory;
const routerToUse = uniSwapRouter;
const UNLOCKED_ACCOUNT = "0x0e5069514a3Dd613350BAB01B58FD850058E5ca4"; // SHIB Unlocked Account.
// TODO: make this amount configurable.
const AMOUNT = "40500000000000"; // 40,500,000,000,000 SHIB -- Tokens will automatically be converted to wei
const GAS = 450000;

const main = async () => {
    const accounts = await ethers.listAccounts();

    // This will be the account to recieve WETH after we perform the swap to manipulate price.
    const account = accounts[1]; // ! 0 index? 

    // TODO: ^ determine what's actually going on with this account above recieving ether.

    const pairContract = await getPairContract(factoryToUse, erc20Address, WETH[chainId].address);

    const token = new Token(
        ChainId.MAINNET,
        erc20Address,
        18, // 18 decimal token.
        await erc20Contract.symbol(), // ! will ethers method calls here work? 
        await erc20Contract.name(),
    );

    // Fetch price of SHIB/WETH before we execute the swap.
    const priceBefore = await calculatePrice(pairContract);

    await manipulateTestNetPrice(token, account);

    // Fetch price of SHIB/WETH after the swap.
    const priceAfter = await calculatePrice(pairContract);

    const data = {
        'Price Before': `1 ${WETH[chainId].symbol} = ${Number(priceBefore).toFixed(0)} ${token.symbol}`,
        'Price After': `1 ${WETH[chainId].symbol} = ${Number(priceAfter).toFixed(0)} ${token.symbol}`,
    }
    console.table(data);

    let balance = await wEthContract.balanceOf(account);
    balanceInWEth = formatEther(balance.toString());

    console.log(`\nBalance in reciever account: ${balanceInWEth} WETH.\n`);
}

main(); // ? Move to bottom? 

/**
 * TODO: summary.
 * @param {token} ERC20 token contract. 
 * @param {signer} Account to recieve funds.
 */
async function manipulateTestNetPrice(token, signer) {
    console.log(`\nBeginning Swap...\n`);
    console.log(`Input Token: ${token.symbol}`);
    console.log(`Output Token: ${WETH[chainId].symbol}\n`);

    const amountInSmallestDecimal = ethers.utils.parseUnits(AMOUNT, "ether"); // ! confirm this works.

    const path = [token.address, WETH[chainId].address];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes.

    await erc20Contract.approve(routerToUse._address, amountInSmallestDecimal); // !will need signer here.
    const options = { gasLimit: GAS };
    const receipt = await routerToUse.swapExactTokensForTokens(
        amountInSmallestDecimal, 0, path, signer, deadline, options);
        // ! might need to pass in unlocked account in new contract with new signer ?

    console.log(`Swap Complete!\n`);

    return receipt;
}

module.exports = {
    manipulateTestNetPrice,
}
