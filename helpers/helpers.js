require("dotenv").config();
const config = require("../config.json")
const Big = require("big.js");
const { ethers, waffle } = require("hardhat");
const { ChainId, Token } = require("@uniswap/sdk");
const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
const IERC20 = require("@openzeppelin/contracts/build/contracts/ERC20.json");

// TODO: need to populate this within each function.
let provider;

// ! Should I use get default provider here? 
async function getProvider() {
    if (config.PROJECT_SETTINGS.isLocal) 
        return waffle.provider;
    // TODO: determine if this prod url is correct. 
    return new ethers.providers.JsonRpcProvider("wss://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}");
}

async function getTokenAndContract(_token0Address, _token1Address) {
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

async function getPairAddress(_V2Factory, _token0, _token1) {
    const pairAddress = await _V2Factory.methods.getPair(_token0, _token1).call()
    return pairAddress
}

async function getPairContract(_V2Factory, _token0, _token1) {
    const pairAddress = await getPairAddress(_V2Factory, _token0, _token1)
    const pairContract = new web3.eth.Contract(IUniswapV2Pair.abi, pairAddress)
    return pairContract
}

async function getReserves(_pairContract) {
    const reserves = await _pairContract.methods.getReserves().call()
    return [reserves.reserve0, reserves.reserve1]
}

async function calculatePrice(_pairContract) {
    const [reserve0, reserve1] = await getReserves(_pairContract)
    return Big(reserve0).div(Big(reserve1)).toString()
}

function calculateDifference(uPrice, sPrice) {
    return (((uPrice - sPrice) / sPrice) * 100).toFixed(2)
}

async function getEstimatedReturn(amount, _routerPath, _token0, _token1) {
    const trade1 = await _routerPath[0].methods.getAmountsOut(amount, [_token0.address, _token1.address]).call()
    const trade2 = await _routerPath[1].methods.getAmountsOut(trade1[1], [_token1.address, _token0.address]).call()

    const amountIn = Number(web3.utils.fromWei(trade1[0], 'ether'))
    const amountOut = Number(web3.utils.fromWei(trade2[1], 'ether'))

    return { amountIn, amountOut }
}

module.exports = {
    getProvider,
    getTokenAndContract,
    getPairAddress,
    getPairContract,
    getReserves,
    calculatePrice,
    calculateDifference,
    getEstimatedReturn
}