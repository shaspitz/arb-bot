require("dotenv").config();
const { UNISWAP, SUSHISWAP } = require("../config.json");
const { ChainId, Token, WETH } = require("@uniswap/sdk");
const chainId = ChainId.MAINNET;
const { abi: uniSwapRouterAbi } = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");
const { abi: uniSwapFactoryAbi } = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const { abi: erc20Abi } = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const { ethers } = require("hardhat");
// const { getPairContract, calculatePrice } = require("../helpers/helpers");

// Impersonation account config, see etherscan for more details.
const accountToImpersonate = "0x72a53cdbbcc1b9efa39c834a540550e23463aacb";  
const AMOUNT = "36000000000000"; // 36,000,000,000,000 SHIB are held by this whale account.
const GAS = 450000;
let signer;

/**
 * Manipulates the price of a relevant token pair, to properly test arbitrage opportunities
 * in a local dev environment.  
 */
async function setupAndManipulatePrice() {

    signer = await impersonateWhaleAccount();

    // Instantiate contract objects.
    const uniSwapFactory = await ethers.getContractAt(uniSwapFactoryAbi, UNISWAP.FACTORY_ADDRESS, signer);
    const sushiSwapFactory = await ethers.getContractAt(uniSwapFactoryAbi, SUSHISWAP.FACTORY_ADDRESS, signer);
    const uniSwapRouter = await ethers.getContractAt(uniSwapRouterAbi, UNISWAP.V2_ROUTER_02_ADDRESS, signer);
    const sushiSwapRouter = await ethers.getContractAt(uniSwapRouterAbi, SUSHISWAP.V2_ROUTER_02_ADDRESS, signer);
    const erc20Contract = new ethers.Contract(process.env.ARB_AGAINST, erc20Abi, signer);

    // Arbitrage will be against given ERC20 token.
    const wEthContract = await ethers.getContractAt(erc20Abi, WETH[chainId].address, signer);

    // TODO: make this functionality better. 
    const factoryToUse = uniSwapFactory;
    const routerToUse = uniSwapRouter;

    const accounts = await ethers.listAccounts();

    // This will be the account to recieve WETH after we perform the swap to manipulate price.
    const account = accounts[1]; // ! 0 index? 

    const pairContract = await getPairContract(factoryToUse, erc20Address, WETH[chainId].address);

    const token = new Token( // Uniswap sdk token obj. 
        ChainId.MAINNET,
        erc20Address,
        18, // 18 decimal token.
        await erc20Contract.symbol(), 
        await erc20Contract.name(),
    );

    // Fetch price of SHIB/WETH before we execute the swap.
    const priceBefore = await calculatePrice(pairContract);

    await manipulateTestNetPrice(erc20Contract, account, signer);

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
/**
 * @returns A whale account signer from accountToImpersonate globally defined above.
 */
async function impersonateWhaleAccount() {
    // Hardhat's method of impersonating a whale account. See https://hardhat.org/hardhat-network/reference/#hardhat-impersonateaccount.
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [accountToImpersonate],
    });
    return ethers.getSigner(accountToImpersonate);
}

/**
 * @param {erc20Contract} Contract for ERC20 token that we're arbing against, assumed already signed.
 * @param {router} DEX router to execute exchange, assumed already signed.
 * @param {account} Account to recieve funds.
 */
async function manipulatePrice(erc20contract, router, account) {
    const tokenSymbol = await erc20contract.symbol();
    const wEthSymbol = WETH[chainId].symbol;
    console.log(`\nBeginning Swap...\n`);
    console.log(`Input Token: ${tokenSymbol}`);
    console.log(`Output Token: ${wEthSymbol}\n`);

    const amountInSmallestDecimal = ethers.utils.parseUnits(AMOUNT.toString(), "ether"); 
    const path = [erc20contract.address, WETH[chainId].address];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes.
    const options = { gasLimit: GAS };

    await erc20contract.approve(router.address, amountInSmallestDecimal);
    
    const receipt = await router.swapExactTokensForTokens(
        amountInSmallestDecimal, 0, path, account.address, deadline, options);

    console.log(`Swap Complete!\n`);

    return receipt;
}

module.exports = {
    AMOUNT,
    setupAndManipulatePrice,
    impersonateWhaleAccount,
    manipulatePrice,
};
