require("dotenv").config();
const { ChainId, WETH } = require("@uniswap/sdk");
const chainId = ChainId.MAINNET;
const { abi: erc20Abi } = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const { ethers, waffle } = require("hardhat");
const {  warnAboutEphemeralNetwork } = require("../helpers/helpers");

// TODO: Make this script non hardcoded. Uses accounts[1].

async function main() {

    warnAboutEphemeralNetwork();

    const signers = await ethers.getSigners();
    const signer = signers[1];

    console.log("Balances for address: ", signer.address);

    const provider = waffle.provider;
    let ethBalance = await provider.getBalance(signer.address);
    ethBalance = await ethers.utils.formatEther(ethBalance);
    console.log("ETH: ", ethBalance.toString());

    const erc20Contract = new ethers.Contract(process.env.ARB_AGAINST, erc20Abi, signers[1]);
    let erc20Balance = await erc20Contract.balanceOf(signer.address);
    erc20Balance = await ethers.utils.formatEther(erc20Balance);
    const symbol = await erc20Contract.symbol();
    console.log(symbol.toString() + ": ", erc20Balance.toString());

    const wEthContract = new ethers.Contract(WETH[chainId].address, erc20Abi, signers[1]);
    let wEthBalance = await wEthContract.balanceOf(signer.address);
    wEthBalance = await ethers.utils.formatEther(wEthBalance);
    console.log("WETH: ", wEthBalance.toString());
};
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});