require("dotenv").config();
const config = require("../config.json")
const Big = require("big.js");
const { ethers, waffle } = require("hardhat");
const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
const IERC20 = require("@openzeppelin/contracts/build/contracts/ERC20.json");

async function warnAboutEphemeralNetwork() {
    if (network.name === "hardhat") {
        console.warn(
            "You are using the Hardhat Network, which gets automatically created and destroyed every time." +
            " Use the Hardhat option \"--network localhost\" if running outside of tests."
        );
    }
}

// ! Should I use get default provider here? 
async function getProvider() {
    if (config.PROJECT_SETTINGS.isLocal) 
        return waffle.provider;
    // TODO: determine if this prod url is correct. 
    return new ethers.providers.JsonRpcProvider(`wss://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`);
}

/**
 * Gets the custom arbitrage contract, and deployer/owner of that contract.
 * Only to be used on local hardhat network! Mainnet needs separate handling.
 */
async function getArbContractAndDeployer() {
    // Use contract factory instead of instantiating ethers.Contract object,
    // since the relevant contract needs to be deployed.  
    // Note: real deploys should use contract factory constructor instead of "getContractFactory". 
    const arbitrageContract = await ethers.getContractFactory("Arbitrage");
    
    // With hardhat-ethers plugin, contract is deployed to first signer by default.
    const deployedContract = await arbitrageContract.deploy(
        config.SUSHISWAP.V2_ROUTER_02_ADDRESS, 
        config.UNISWAP.V2_ROUTER_02_ADDRESS
    );
    
    let deployer;
    [deployer] = await ethers.getSigners();
    
    return { deployedContract, deployer };
}

/**
 * Instantiates and returns two ERC20 contracts for two token addresses. 
 * @param  {} token0Address
 * @param  {} token1Address
 */
async function getTokenContracts(token0Address, token1Address) {
    const token0Contract = new ethers.Contract(IERC20.abi, token0Address);
    const token1Contract = new ethers.Contract(IERC20.abi, token1Address);
    return { token0Contract, token1Contract }
}

/**
 * Gets a pair contract address given a uniswap factory contract and token pair.
 * See https://docs.uniswap.org/protocol/V2/reference/smart-contracts/factory.
 * @param  {} factoryContract
 * @param  {} token0
 * @param  {} token1
 */
async function getPairAddress(factoryContract, token0, token1) {
    return factoryContract.getPair(token0, token1);
}

/**
 * Gets a pair contract from a relevant factory contract and token pair.
 * See: https://docs.uniswap.org/protocol/V2/reference/smart-contracts/pair.
 * @param  {} factoryContract
 * @param  {} token0
 * @param  {} token1
 * @param  {} signer input to the instantiated pair contract, if desired.
 */
async function getPairContract(factoryContract, token0, token1, signer) { 
    const pairAddress = await getPairAddress(factoryContract, token0, token1);
    return new ethers.Contract(pairAddress, IUniswapV2Pair.abi, signer);
}
/**
 * Returns the reserves of token0 and token1 (implicit to a pair contract)
 * used to price trades and distribute liquidity.
 * https://docs.uniswap.org/protocol/V2/reference/smart-contracts/pair#getreserves.
 * @param  {} pairContract
 */
async function getReserves(pairContract) {
    const reserves = await pairContract.getReserves();
    return [reserves.reserve0, reserves.reserve1];
}

/**
 * Calculates the price of a token pair given that pair's contract,
 * using the constant product formula, x*y=k. 
 * See: https://docs.uniswap.org/protocol/V2/concepts/advanced-topics/pricing.
 * @param  {} pairContract
 */
async function calculatePrice(pairContract) {
    const [reserve0, reserve1] = await getReserves(pairContract);
    return Big(reserve0).div(Big(reserve1)).toString();
}

function calculateDifference(uPrice, sPrice) {
    // remember to update these methods and acd all the neccessary comments!!
    // ! Need to update.
    return (((uPrice - sPrice) / sPrice) * 100).toFixed(2)
}

async function getEstimatedReturn(amount, _routerPath, _token0, _token1) {
    // ! Need to update. 
    const trade1 = await _routerPath[0].methods.getAmountsOut(amount, [_token0.address, _token1.address]).call()
    const trade2 = await _routerPath[1].methods.getAmountsOut(trade1[1], [_token1.address, _token0.address]).call()

    const amountIn = Number(web3.utils.fromWei(trade1[0], 'ether'))
    const amountOut = Number(web3.utils.fromWei(trade2[1], 'ether'))

    return { amountIn, amountOut }
}

module.exports = {
    warnAboutEphemeralNetwork,
    getProvider,
    getArbContractAndDeployer,
    getTokenContracts,
    getPairAddress,
    getPairContract,
    getReserves,
    calculatePrice,
    calculateDifference,
    getEstimatedReturn
}