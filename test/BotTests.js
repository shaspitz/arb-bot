const { expect } = require("chai");
require("dotenv").config();
const config = require('../config.json');
const { initialSetup, getPriceDifferencePercent, determineDirection, determineProfitability, } = require("../helpers/botHelpers");
const { setupAndManipulatePrice, } = require("../helpers/localPriceManipulator");
const { resetHardhatToFork } = require('../helpers/generalHelpers');


describe("Bot helpers module", async function () {

  beforeEach(async function () {
    await resetHardhatToFork();
    await initialSetup();
  })

  it(`Test functionality of getPriceDifferencePercent, how it feeds into determineDirection, 
    and finally how this feeds into the determineProfitability function.`,
    async function () {
    const priceDiffBefore = await getPriceDifferencePercent();

    // Local price manipulator dumps SHIB into a SHIB/WETH pool on uniswap. 
    // Therefore the SHIB/WETH price on uniswap should go up, and percentage
    // returned from "checkPrice" (uni price - sushi price) / sushi price should go up too.  
    const arbitraryDumpAmount = "1000000000";
    await setupAndManipulatePrice(arbitraryDumpAmount); 

    const priceDiffAfter = await getPriceDifferencePercent();
    expect(Number(priceDiffAfter)).to.be.greaterThan(Number(priceDiffBefore));

    // There should be a positive price difference between the DEXs, so determineDirection 
    // should return a path starting with uniswap.
    const routerPath = await determineDirection(priceDiffAfter, 0.01);
    expect(routerPath[0].address).to.be.equal(config.UNISWAP.V2_ROUTER_02_ADDRESS);

    const isProfitable = await determineProfitability(routerPath);
    console.log(isProfitable);
  });

  it("Test function that executes trade on custom Solidity contract.",
  async function () {
    // TODO: populate this.
  })
});
