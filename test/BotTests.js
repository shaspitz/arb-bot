const { expect } = require("chai");
require("dotenv").config();
const config = require('../config.json');
const { initialSetup, getPriceDifferencePercent, determineDirection,
  determineProfitability, executeTrade } = require("../helpers/botHelpers");
const { UNISWAP, SUSHISWAP, } = require("../config.json");
const { setupAndManipulatePrice, } = require("../helpers/localPriceManipulator");
const { resetHardhatToFork } = require('../helpers/generalHelpers');

let token0Contract, token1Contract;

describe("Bot helpers module", async function () {

  beforeEach(async function () {
    await resetHardhatToFork();
    const res = await initialSetup();
    token0Contract = res[0];
    token1Contract = res[1];
  })

  it(`Test functionality of getPriceDifferencePercent, how it feeds into determineDirection, 
    and finally how this feeds into the determineProfitability function.`,
    async function () {
    const priceDiffBefore = await getPriceDifferencePercent();

    // Local price manipulator dumps SHIB into a SHIB/WETH pool on uniswap. 
    // Therefore the SHIB/WETH price on uniswap should go up, and percentage
    // returned from "checkPrice" (uni price - sushi price) / sushi price should go up too.  
    let arbitraryDumpAmount = "10000000000000";
    await setupAndManipulatePrice(arbitraryDumpAmount, UNISWAP.V2_ROUTER_02_ADDRESS); 

    // Let's dump a tad on sushiswap to provide some liquidity to it's pools
    // TODO: Alternative is just to actually provide a liquidity pair by impersonating some account, or find better DEX.
    arbitraryDumpAmount = "1000000";
    await setupAndManipulatePrice(arbitraryDumpAmount, SUSHISWAP.V2_ROUTER_02_ADDRESS);

    const priceDiffAfter = await getPriceDifferencePercent();
    expect(Number(priceDiffAfter)).to.be.greaterThan(Number(priceDiffBefore));

    // There should be a positive price difference between the DEXs, so determineDirection 
    // should return a path starting with uniswap.
    const routerPath = await determineDirection(priceDiffAfter, 0.01);
    expect(routerPath[0].address).to.be.equal(config.UNISWAP.V2_ROUTER_02_ADDRESS);

    const isProfitable = await determineProfitability(routerPath);
    console.log("Is this trade profitable?:", isProfitable);

    // Sushiswap does not have enough liquidity (at this EVM fork) for an arb to be profitable.
    expect(isProfitable).to.be.false;

    // Note that if the "sell" DEX's reserves are depleted, the executeTrade function will not
    // neccessarily revert, but will only swap a portion of the requested amount to borrow.
    const success = await executeTrade(routerPath,
      arbitraryDumpAmount, // amount of token0 to trade
      token0Contract,
      token1Contract);
  
    expect(success).to.be.true;
  });
});
