require("dotenv").config();
const config = require("../config.json")
const Big = require("big.js");
const { ethers, waffle } = require("hardhat");
const { ChainId, Token } = require("@uniswap/sdk");
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
    return new ethers.providers.JsonRpcProvider("wss://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}");
}

async function getTokenAndContract(_token0Address, _token1Address) {
    // ! Need to update.
    const token0Contract = new web3.eth.Contract(IERC20.abi, _token0Address)
    const token1Contract = new web3.eth.Contract(IERC20.abi, _token1Address)

    const token0 = new Token(
        ChainId.MAINNET,
        _token0Address,
        18,
        await token0Contract.methods.symbol().call(),
        await token0Contract.methods.name().call()
    )

    const token1 = new Token(
        ChainId.MAINNET,
        _token1Address,
        18,
        await token1Contract.methods.symbol().call(),
        await token1Contract.methods.name().call()
    )

    return { token0Contract, token1Contract, token0, token1 }
}

/**
 * Gets a pair contract address given a uniswap factory contract and token pair.
 * See https://docs.uniswap.org/protocol/V2/reference/smart-contracts/factory.
 * @param  {factoryContract} 
 * @param  {token0} 
 * @param  {token1} 
 */
async function getPairAddress(factoryContract, token0, token1) {
    return factoryContract.getPair(token0, token1);
}

/**
 * Gets a pair contract from a relevant factory contract and token pair.
 * See: https://docs.uniswap.org/protocol/V2/reference/smart-contracts/pair.
 * @param  {factoryContract} 
 * @param  {token0} 
 * @param  {token1} 
 * @param  {signer} Input to the instantiated pair contract, if desired.
 */
async function getPairContract(factoryContract, token0, token1, signer) { 
    const pairAddress = await getPairAddress(factoryContract, token0, token1);
    return new ethers.Contract(pairAddress, IUniswapV2Pair.abi, signer);
}

async function getReserves(pairContract) {
    const reserves = await pairContract.getReserves();
    return [reserves.reserve0, reserves.reserve1];
}

async function calculatePrice(pairContract) {
    const [reserve0, reserve1] = await getReserves(pairContract);
    return Big(reserve0).div(Big(reserve1)).toString();
}

function calculateDifference(uPrice, sPrice) {
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
    getTokenAndContract,
    getPairAddress,
    getPairContract,
    getReserves,
    calculatePrice,
    calculateDifference,
    getEstimatedReturn
}