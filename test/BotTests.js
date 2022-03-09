const { initialSetup, checkPrice } = require("../helpers/botHelpers");
const { setupAndManipulatePrice, AMOUNT } = require("../helpers/localPriceManipulator");

before(async function () {
    await initialSetup();
})

describe("Bot helpers module", async function () {
  it("Test CheckPrice functionality", async function () {
    const priceBefore = await checkPrice();

    setupAndManipulatePrice();

    const priceAfter = await checkPrice();

    // TODO: need to build out these tests more.. percentage differences look off.
  });
});
