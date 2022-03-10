require("dotenv").config();
const { initialSetup, checkPrice } = require("../helpers/botHelpers");
const { setupAndManipulatePrice, AMOUNT } = require("../helpers/localPriceManipulator");
const { resetHardhatToFork } = require('../helpers/generalHelpers');


describe("Bot helpers module", async function () {

  beforeEach(async function () {
    await resetHardhatToFork();
    await initialSetup();
  })

  it("Test CheckPrice functionality", async function () {
    const priceBefore = await checkPrice();

    const arbitraryDumpAmount = "1000000000";
    const {expectedPriceBefore, expectedPriceAfter} = await setupAndManipulatePrice(arbitraryDumpAmount); 

    const priceAfter = await checkPrice();
    // TODO: need to build out these tests more.. percentage differences look off.
  });
});
