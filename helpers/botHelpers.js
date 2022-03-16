require("dotenv").config();
const config = require('../config.json');
const { ethers, network, } = require("hardhat");
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const { getTokenContracts, getPairContract, calculatePrice,
    getEstimatedReturn, getReserves, configureArbContractAndSigner, getProvider, } = require('../helpers/generalHelpers');

// Token we're attempting to gain.
const arbFor = process.env.ARB_FOR;
// Intermediary token in arb process.
const arbAgainst = process.env.ARB_AGAINST;
// Account to recieve profit.
const account = process.env.ACCOUNT;
// Used for price display/reporting.
const units = process.env.UNITS;
const priceDifferenceThresh = process.env.PRICE_DIFFERENCE;

// TODO: Gas config may change between chains, look into this.
const gas = process.env.GAS_LIMIT;
const estimatedGasCost = process.env.GAS_PRICE; // Estimated Gas: 0.008453220000006144 ETH + ~10%

let uniSwapPairContract, sushiSwapPairContract,
    uniSwapFactoryContract, uniSwapRouterContract,
    sushiSwapFactoryContract, sushiSwapRouterContract,
    arbitrageContract;

let amount; // TODO: make "amount" more descriptive.

let provider;

let token0Symbol, token1Symbol;

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

    const { token0Contract, token1Contract } = await getTokenContracts(arbFor, arbAgainst, signer);

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

    // Subscribe to events outside the context of automated tests. 
    if (network.name != "hardhat") {
        uniSwapPairContract.on("Swap", async () => {
            await handleSwapEvent("Uniswap");
        });
    
        sushiSwapPairContract.on("Swap", async () => {
            await handleSwapEvent("Sushiswap");
        });
    }
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

        const isProfitable = await determineProfitability(routerPath, token0Contract, token0, token1);

        if (!isProfitable) {
            console.log(`No Arbitrage Currently Available\n`);
            console.log(`-----------------------------------------\n`);
            isExecuting = false;
            return;
        }

        const receipt = await executeTrade(routerPath, token0Contract, token1Contract);

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

    console.log(`Determining Direction...\n`)

    if (priceDifferencePercent >= thresh) {
        console.log(`Potential Arbitrage Direction:\n`);
        console.log(`Buy\t -->\t Uniswap`);
        console.log(`Sell\t -->\t Sushiswap\n`);
        return [uniSwapRouterContract, sushiSwapRouterContract];
    }
    
    if (priceDifferencePercent <= -thresh) {
        console.log(`Potential Arbitrage Direction:\n`)
        console.log(`Buy\t -->\t Sushiswap`)
        console.log(`Sell\t -->\t Uniswap\n`)
        return [sushiSwapRouterContract, uniSwapRouterContract];
    } 
    return null;
}

/**
 * TODO: summary!
 * @param  {} routerPath
 * @param  {} token0Contract
 * @param  {} token0
 * @param  {} token1
 */
async function determineProfitability(routerPath, token0Contract, token0, token1) {
    console.log(`Determining Profitability...\n`)

    // This is where you can customize your conditions on whether a profitable trade is possible.
    // This is a basic example of trading WETH/SHIB...

    // TODO: Move intelligent logic to a private repo. Anyone can have this simple example tho.

    // TODO: Need to look into how slippage relates to everything here. Strategy can stay simple in this repo,
    // but should be more complex in private repo. At least type up a good explanation.

    let reserves, exchangeToBuy, exchangeToSell

    if (_routerPath[0]._address == uRouter._address) {
        reserves = await getReserves(sPair)
        exchangeToBuy = 'Uniswap'
        exchangeToSell = 'Sushiswap'
    } else {
        reserves = await getReserves(uPair)
        exchangeToBuy = 'Sushiswap'
        exchangeToSell = 'Uniswap'
    }

    console.log(`Reserves on ${_routerPath[1]._address}`)
    console.log(`SHIB: ${Number(web3.utils.fromWei(reserves[0].toString(), 'ether')).toFixed(0)}`)
    console.log(`WETH: ${web3.utils.fromWei(reserves[1].toString(), 'ether')}\n`)

    try {

        // This returns the amount of WETH needed
        let result = await _routerPath[0].methods.getAmountsIn(reserves[0], [_token0.address, _token1.address]).call()

        const token0In = result[0] // WETH
        const token1In = result[1] // SHIB

        result = await _routerPath[1].methods.getAmountsOut(token1In, [_token1.address, _token0.address]).call()

        console.log(`Estimated amount of WETH needed to buy enough Shib on ${exchangeToBuy}\t\t| ${web3.utils.fromWei(token0In, 'ether')}`)
        console.log(`Estimated amount of WETH returned after swapping SHIB on ${exchangeToSell}\t| ${web3.utils.fromWei(result[1], 'ether')}\n`)

        const { amountIn, amountOut } = await getEstimatedReturn(token0In, _routerPath, _token0, _token1)

        let ethBalanceBefore = await web3.eth.getBalance(account)
        ethBalanceBefore = web3.utils.fromWei(ethBalanceBefore, 'ether')
        const ethBalanceAfter = ethBalanceBefore - estimatedGasCost

        // TODO: update the rest of this method, use task concurrency where possible. 

        const amountDifference = amountOut - amountIn
        let wethBalanceBefore = await _token0Contract.methods.balanceOf(account).call()
        wethBalanceBefore = web3.utils.fromWei(wethBalanceBefore, 'ether')

        const wethBalanceAfter = amountDifference + Number(wethBalanceBefore)
        const wethBalanceDifference = wethBalanceAfter - Number(wethBalanceBefore)

        const totalGained = wethBalanceDifference - Number(estimatedGasCost)

        const data = {
            'ETH Balance Before': ethBalanceBefore,
            'ETH Balance After': ethBalanceAfter,
            'ETH Spent (gas)': estimatedGasCost,
            '-': {},
            'WETH Balance BEFORE': wethBalanceBefore,
            'WETH Balance AFTER': wethBalanceAfter,
            'WETH Gained/Lost': wethBalanceDifference,
            '-': {},
            'Total Gained/Lost': totalGained
        }

        console.table(data)
        console.log()

        if (amountOut < amountIn) {
            return false
        }

        amount = token0In
        return true

    } catch (error) {
        console.log(error.data.stack)
        console.log(`\nError occured while trying to determine profitability...\n`)
        console.log(`This can typically happen because an issue with reserves, see README for more information.\n`)
        return false
    }
}

/**
 * TODO: summary
 * TODO: var names
 * @param  {} _routerPath
 * @param  {} _token0Contract
 * @param  {} _token1Contract
 */
async function executeTrade(_routerPath, _token0Contract, _token1Contract) {
    console.log(`Attempting Arbitrage...\n`)

    let startOnUniswap

    if (_routerPath[0]._address == uRouter._address) {
        startOnUniswap = true
    } else {
        startOnUniswap = false
    }

    // TODO: update the rest of this method, use task concurrency where possible. 

    // Fetch token balances before trade.
    const balanceBefore = await _token0Contract.methods.balanceOf(account).call()
    const ethBalanceBefore = await web3.eth.getBalance(account)

    if (config.PROJECT_SETTINGS.shouldExecuteTrade) {
        await _token0Contract.methods.approve(arbitrage._address, amount).send({ from: account })
        await arbitrage.methods.executeTrade(startOnUniswap, _token0Contract._address, _token1Contract._address, amount).send({ from: account, gas: gas })
    }

    console.log(`Trade Complete:\n`)

    // Fetch token balance after
    const balanceAfter = await _token0Contract.methods.balanceOf(account).call()
    const ethBalanceAfter = await web3.eth.getBalance(account)

    const balanceDifference = balanceAfter - balanceBefore
    const totalSpent = ethBalanceBefore - ethBalanceAfter

    const data = {
        'ETH Balance Before': web3.utils.fromWei(ethBalanceBefore, 'ether'),
        'ETH Balance After': web3.utils.fromWei(ethBalanceAfter, 'ether'),
        'ETH Spent (gas)': web3.utils.fromWei((ethBalanceBefore - ethBalanceAfter).toString(), 'ether'),
        '-': {},
        'WETH Balance BEFORE': web3.utils.fromWei(balanceBefore.toString(), 'ether'),
        'WETH Balance AFTER': web3.utils.fromWei(balanceAfter.toString(), 'ether'),
        'WETH Gained/Lost': web3.utils.fromWei(balanceDifference.toString(), 'ether'),
        '-': {},
        'Total Gained/Lost': `${web3.utils.fromWei((balanceDifference - totalSpent).toString(), 'ether')} ETH`
    }

    console.table(data);
}

module.exports = {
    initialSetup,
    getPriceDifferencePercent,
    determineDirection,
}