require("dotenv").config();
const config = require('../config.json');
const { ethers, network, } = require("hardhat");
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const { getTokenContracts, getPairContract, calculatePrice,
    getEstimatedReturn, getReserves, configureArbContractAndSigner, getProvider, } = require('./helpers');

// Token we're attempting to gain.
const arbFor = process.env.ARB_FOR;
// Intermediary token in arb process.
const arbAgainst = process.env.ARB_AGAINST;
// Account to recieve profit.
let account = process.env.ACCOUNT;
// Used for price display/reporting.
const units = process.env.UNITS;
const priceDifferenceThresh = process.env.PRICE_DIFFERENCE;

// TODO: Gas config may change between chains, look into this.
const gasLimit = process.env.GAS_LIMIT;
const estimatedGasCost = process.env.GAS_PRICE; // Estimated Gas: 0.008453220000006144 ETH + ~10%

let uniSwapPairContract, sushiSwapPairContract,
    uniSwapFactoryContract, uniSwapRouterContract,
    sushiSwapFactoryContract, sushiSwapRouterContract,
    arbitrageContract;

// Amount of token0 to borrow and use for arbitrage.
let token0TradeAmount;

let provider;

let token0Symbol, // Symbol of token we're arbing for.
token1Symbol; // Symbol of token we're arbing against.

let token0Contract, // Contract of token we're arbing for.
token1Contract; // Contract of token we're arbing against.

// Bool to prevent reentrancy-like bugs in the swap event handler.
// A tool like https://medium.com/@chris_marois/asynchronous-locks-in-modern-javascript-8142c877baf
// may be useful here instead, but JS is intended to be single threaded anyways.
// Plus, if we're already attempting to execute a transaction when an event is handled, 
// any other potential arb opportunity would be outdated by the time the first transaction is executed.
// Is it worth adding a priority to arb opportunities, if a waiting transaction is not sent yet?  
let isExecuting = false

/**
 * Handles initial contract instantiations and on-chain event subscriptions.
 */
async function initialSetup() {

    provider = getProvider();

    let res = await configureArbContractAndSigner();
    const signer = res.signer;
    arbitrageContract = res.arbitrageContract;

    // Instantiate all relevant contracts and pass signer from above.
    uniSwapFactoryContract = new ethers.Contract(config.UNISWAP.FACTORY_ADDRESS, IUniswapV2Factory.abi, signer);
    uniSwapRouterContract = new ethers.Contract(config.UNISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, signer);
    sushiSwapFactoryContract = new ethers.Contract(config.SUSHISWAP.FACTORY_ADDRESS, IUniswapV2Factory.abi, signer);
    sushiSwapRouterContract = new ethers.Contract(config.SUSHISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, signer);

    res = await getTokenContracts(arbFor, arbAgainst, signer);

    token0Contract = res.token0Contract;
    token1Contract = res.token1Contract;

    res = await Promise.all([
        getPairContract(uniSwapFactoryContract, token0Contract.address, token1Contract.address, signer),
        getPairContract(sushiSwapFactoryContract, token0Contract.address, token1Contract.address, signer),
        token0Contract.symbol(),
        token1Contract.symbol(),
    ]);
    uniSwapPairContract = res[0];
    sushiSwapPairContract = res[1];
    token0Symbol = res[2];
    token1Symbol = res[3];

    // For automated tests, populate account variable properly. 
    if (network.name == "hardhat") {
        const accounts = await provider.listAccounts();
        account = accounts[0];

        // Return token contracts for testing.
        return [token0Contract, token1Contract];

    // For local testing, still use first default account. Also subscribe to events.
    } else if (network.name == "localhost") {
        const accounts = await provider.listAccounts();
        account = accounts[0];
        await subscribeToOnChainEvents();
    
    // On non test chain, account needs to be populated from .env. Also subscribe to events.
    } else {
        if (account === "") {
            console.log("No account address provided in .env! Kill the process, enter an account and try again.");
            return;
        }
        await subscribeToOnChainEvents();
    }
    console.log(`Starting bot for account address: ${account}`);
}
/**
 * Subscribes to swap events from uniswap and sushiswap.
 */
async function subscribeToOnChainEvents() {
    uniSwapPairContract.on("Swap", async () => {
        await handleSwapEvent("Uniswap");
    });

    sushiSwapPairContract.on("Swap", async () => {
        await handleSwapEvent("Sushiswap");
    });
}

/**
 * Event handler for anyone executing a swap for a specific token pair.
 * See: https://docs.uniswap.org/protocol/V2/reference/smart-contracts/pair#swap.
 * @param  {} exchangeString
 */
 async function handleSwapEvent(exchangeString) {
    if (!isExecuting) {
        isExecuting = true
        
        console.log(`Swap Initiated on ${exchangeString}, Checking Price...\n`);
        const priceDifference = await getPriceDifferencePercent();
        const routerPath = await determineDirection(priceDifference, priceDifferenceThresh);

        if (!routerPath) {
            console.log(`No Arbitrage Currently Available\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }

        const isProfitable = await determineProfitability(routerPath);

        if (!isProfitable) {
            console.log(`No Arbitrage Currently Available\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }

        await executeTrade(routerPath, token0TradeAmount, token0Contract, token1Contract);

        isExecuting = false;
    }
}

/**
 * Queries the chain for the current DEX prices, returns a price difference percentage. 
 */
async function getPriceDifferencePercent() {
    
    const [blockNumber, uniSwapPrice, sushiSwapPrice] = await Promise.all([
        provider.getBlockNumber(),
        calculatePrice(uniSwapPairContract),
        calculatePrice(sushiSwapPairContract),
    ]);

    const formattedUniSwapPrice = Number(uniSwapPrice).toFixed(units);
    const formattedSushiSwapPrice = Number(sushiSwapPrice).toFixed(units);
    const priceDifference = (((formattedUniSwapPrice - formattedSushiSwapPrice) / formattedSushiSwapPrice)
        * 100).toFixed(2);

    console.log(`Current Block: ${blockNumber}`);
    console.log(`-----------------------------------------`);
    console.log(`UNISWAP   | ${token1Symbol}/${token0Symbol} | ${formattedUniSwapPrice}`);
    console.log(`SUSHISWAP | ${token1Symbol}/${token0Symbol} | ${formattedSushiSwapPrice}\n`);
    console.log(`Percentage Difference: ${priceDifference}%\n`);

    return priceDifference;
}

/**
 * Determines which exchange the buy and sell should occur on, if any.
 * Returns null if DEX price differences doesn't exceed the min threshold defined in the .env file. 
 * Otherwise returns the order of DEX routers for a potential arb. 
 * @param  {} priceDifferencePercent
 * @param  {} thresh to deremine potential arbitrage opportunity.
 */
async function determineDirection(priceDifferencePercent, thresh) {

    console.log(`Determining Direction...\n`);

    if (priceDifferencePercent >= thresh) {
        console.log(`Potential Arbitrage Direction:\n`);
        console.log(`Buy\t -->\t Uniswap`);
        console.log(`Sell\t -->\t Sushiswap\n`);
        return [uniSwapRouterContract, sushiSwapRouterContract];
    }
    
    if (priceDifferencePercent <= -thresh) {
        console.log(`Potential Arbitrage Direction:\n`);
        console.log(`Buy\t -->\t Sushiswap`);
        console.log(`Sell\t -->\t Uniswap\n`);
        return [sushiSwapRouterContract, uniSwapRouterContract];
    } 
    return null;
}

/**
 * A basic/first-pass strategy for determining arbitrage profitability between uniswap
 * and sushiswap. 
 * 
 * First, we get the token reserves from the second ("sell") DEX, then choose a portion of 
 * the token1 ("arb against") reserve. This will be the theoretical amount to obtain from the first ("buy") DEX,
 * right now this is portion is 1/2. Next, compute the minimum amount of token0 ("arb for") it'll take to get our 
 * set amount of token1 from the "buy" DEX. Lastly, we compute the max amount of token0 we can obtain
 * from selling our set amount of token1 on the "sell" DEX. 
 * 
 * If the value of token0 that is gained exceeds gas fees in ETH, the theoretical trade would
 * be profitable, and we return true. Otherwise we return false.  
 * 
 * In this simple example, token0 is WETH, which makes profit calcs pretty easy.
 * 
 * @param  {} routerPath
 */
async function determineProfitability(routerPath) {
    console.log(`Determining Profitability...\n`);

    // First router contract in path is the DEX we buy from.
    let buyOnUniSwap;
    if (routerPath[0].address == uniSwapRouterContract.address) buyOnUniSwap = true;
    else buyOnUniSwap = false;

    // Liquidity reserves of DEX pair contract, first value being token0, second value being token1. 
    let reservesOfSellExchange;

    // Populate strings for logging, obtain reserves of exchange that we'll potentially sell on.
    let exchangeToBuy, exchangeToSell;
    if (buyOnUniSwap) {
        reservesOfSellExchange = await getReserves(sushiSwapPairContract);
        exchangeToBuy = "Uniswap";
        exchangeToSell = "Sushiswap";
    } else {
        reservesOfSellExchange = await getReserves(uniSwapPairContract);
        exchangeToBuy = "Sushiswap";
        exchangeToSell = "Uniswap";
    }

    console.log(`Reserves on exchange for potential sell [${exchangeToSell}: ${routerPath[1].address}]\n`);
    console.log(`${token0Symbol}: ${ethers.utils.formatEther(reservesOfSellExchange[0]).toString()}\n`);
    console.log(`${token1Symbol}: ${ethers.utils.formatEther(reservesOfSellExchange[1]).toString()}\n`);

    try {
        // See https://docs.uniswap.org/protocol/V2/reference/smart-contracts/library#getamountsin.
        // The uniswap-based function calculates a minimum input token amount given an output amount, accounting for reserves. 
        // Here, we are obtaining the minimum amount of token0 we'd need to swap on the "buy" exchange,
        // to obtain HALF the amount of token1 in the reserves of the "sell" exchange. 
        let result = await routerPath[0].getAmountsIn(
            reservesOfSellExchange[1].div(2), // AmountOut, in token1.
            [token0Contract.address, token1Contract.address] // Path.
        ); 

        const minToken0In = result[0];
        const token1Out = result[1];

        console.assert(token1Out.toString() == reservesOfSellExchange[1].div(2).toString(),
            `We have specified an amount of output tokens from the buy exchange,
                equal to HALF the reserve of that token on the sell exchange`);

        // https://docs.uniswap.org/protocol/V2/reference/smart-contracts/library#getamountsout.
        // The uniswap-based function calculates a maximum output token amount given an input amount, accounting for reserves. 
        // Here, we are obtaining the maximum amount of token0 we could get from the "sell" exchange,
        // for the amount of token1 we'd be able to obtain from the "buy" exchange. This would deplete
        // HALF of the reserves for token1 in the "sell" exchange.
        result = await routerPath[1].getAmountsOut(
            token1Out, // AmountIn for this function is specified amountOut in token1 from last function.
            [token1Contract.address, token0Contract.address] // Path.
        );

        console.log(`Estimated amount of ${token0Symbol} needed to buy enough ${token1Symbol} on ${exchangeToBuy}\t\t| ${ethers.utils.formatEther(minToken0In)}`);
        console.log(`Estimated amount of ${token0Symbol} returned after swapping ${token1Symbol} on ${exchangeToSell}\t| ${ethers.utils.formatEther(result[1])}\n`);

        const token0Out = await getEstimatedReturn(minToken0In, routerPath, token0Contract.address, token1Contract.address);

        let ethBalanceBefore = ethers.utils.formatEther(await provider.getBalance(account));
        const ethBalanceAfter = Number(ethBalanceBefore) - Number(estimatedGasCost);

        const theoreticalToken0ToGain = ethers.utils.formatEther(token0Out - minToken0In);
        const token0Before = ethers.utils.formatEther(await token0Contract.balanceOf(account));

        const token0After = Number(token0Before) + Number(theoreticalToken0ToGain);
        const totalGained = Number(theoreticalToken0ToGain) - Number(estimatedGasCost);

        const data = {
            'ETH Balance Before': ethBalanceBefore,
            'ETH Balance After': ethBalanceAfter,
            'ETH Spent (gas)': estimatedGasCost,
            '-': {},
            'Token0 Balance BEFORE': token0Before, // WETH for now.
            'Token0 Balance AFTER': token0After,
            'Token0 Gained/Lost': theoreticalToken0ToGain,
            '-': {},
            'Total Gained/Lost': totalGained
        };

        console.table(data);

        if (totalGained <= 0) return false;
        token0TradeAmount = minToken0In;
        return true;
    } catch (error) {
        console.log(error.stack);
        console.log(`\nError occured while trying to determine profitability...\n`);
        console.log(`This can typically happen due to issues with reserves\n`);
        return false;
    }
}

/**
 * Attemps to execute trade using the "executeTrade" method from the custom arbitrage contract.
 * @param  {} routerPath
 * @param  {} tradeAmount of token0.
 * @param  {} token0Contract
 * @param  {} token1Contract
 */
async function executeTrade(routerPath, tradeAmount, token0Contract, token1Contract) {
    console.log(`Attempting Arbitrage...\n`);
    console.log(`Account to execute transaction: ${account.toString()}`);

    // First router contract in path is the DEX we buy from.
    let buyOnUniSwap;
    if (routerPath[0].address == uniSwapRouterContract.address) buyOnUniSwap = true;
    else buyOnUniSwap = false;

    // Fetch token balances before trade.
    let res = await Promise.all([
        token0Contract.balanceOf(account),
        provider.getBalance(account),
    ]);
    const balanceBefore = res[0];
    const ethBalanceBefore = res[1];

    if (config.PROJECT_SETTINGS.shouldExecuteTrade) {
        try {
            await token0Contract.approve(arbitrageContract.address, tradeAmount);
            const options = { gasLimit: gasLimit };
            await arbitrageContract.executeTrade(buyOnUniSwap, token0Contract.address,
            token1Contract.address, tradeAmount, options);

        } catch (error) {
            console.log(error.stack);
            console.log(`\nError occured while trying to execute trade...\n`);
            return false;
        }
    }

    console.log(`Trade Complete:\n`);

    // Fetch token balances after trade.
    res = await Promise.all([
        token0Contract.balanceOf(account),
        provider.getBalance(account),
    ]);
    const balanceAfter = res[0];
    const ethBalanceAfter = res[1];

    const token0Gained = balanceAfter - balanceBefore;
    const ethSpent = ethBalanceBefore - ethBalanceAfter;

    const data = {
        'ETH Balance Before': ethers.utils.formatEther(ethBalanceBefore.toString()),
        'ETH Balance After': ethers.utils.formatEther(ethBalanceAfter.toString()),
        'ETH Spent (gas)': ethers.utils.formatEther(ethSpent.toString()),
        '-': {},
        'Token0 Balance BEFORE': ethers.utils.formatEther(balanceBefore.toString()),
        'Token0 Balance AFTER': ethers.utils.formatEther(balanceAfter.toString()),
        'Token0 Gained/Lost': ethers.utils.formatEther(token0Gained.toString()),
        '-': {},
        'Total Gained/Lost': `${ethers.utils.formatEther((token0Gained - ethSpent).toString())} ETH`
    };
    console.table(data);
    return true;
}

module.exports = {
    initialSetup,
    getPriceDifferencePercent,
    determineDirection,
    determineProfitability,
    executeTrade,
}