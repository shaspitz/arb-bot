const { setupAndManipulatePrice, AMOUNT } = require("../helpers/localPriceManipulator");
const { UNISWAP } = require("../config.json");

async function main() {
    await setupAndManipulatePrice(AMOUNT, UNISWAP.V2_ROUTER_02_ADDRESS);
};
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});