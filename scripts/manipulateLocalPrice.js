const { SetupAndManipulatePrice } = require("../helpers/localPriceManipulator");

async function main() {
    await SetupAndManipulatePrice();
};
  
main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});