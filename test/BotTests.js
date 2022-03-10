const { expect } = require("chai");
require("dotenv").config();
const { initialSetup, getPriceDifferencePercent, determineDirection, } = require("../helpers/botHelpers");
const { setupAndManipulatePrice, } = require("../helpers/localPriceManipulator");
const { resetHardhatToFork } = require('../helpers/generalHelpers');


describe("Bot helpers module", async function () {

  beforeEach(async function () {
    await resetHardhatToFork();
    await initialSetup();
  })

  it("Test functionality of getPriceDifferencePercent and how it feeds into determineDirection",
    async function () {
    const priceDiffBefore = await getPriceDifferencePercent();

    // Local price manipulator dumps SHIB into a SHIB/WETH pool on uniswap. 
    // Therefore the SHIB/WETH price on uniswap should go up, and percentage
    // returned from "checkPrice" (uni price - sushi price) / sushi price should go up too.  
    const arbitraryDumpAmount = "1000000000";
    await setupAndManipulatePrice(arbitraryDumpAmount); 

    const priceDiffAfter = await getPriceDifferencePercent();
    expect(Number(priceDiffAfter)).to.be.greaterThan(Number(priceDiffBefore));


  });
});
