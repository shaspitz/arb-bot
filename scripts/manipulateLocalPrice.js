const { setupAndManipulatePrice } = require("../helpers/localPriceManipulator");

async function main() {
    await setupAndManipulatePrice();
};
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});