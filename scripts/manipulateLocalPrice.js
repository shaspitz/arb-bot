const { setupAndManipulatePrice, AMOUNT } = require("../helpers/localPriceManipulator");

async function main() {
    await setupAndManipulatePrice(AMOUNT);
};
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});