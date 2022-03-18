require("dotenv").config();
require("./server");
const { warnAboutEphemeralNetwork } = require('./helpers');
const { initialSetup } = require('./botComponents');

/**
 * Express server that scans for arb opportunities and executes swaps on custom 
 * contract when appropriate. Majority of logic and event handling is within "botHelpers".
 */
async function main() {

    if (!network) {
        console.error("No network was found. Service will exit.");
        return;
    }
    warnAboutEphemeralNetwork();
    console.log("Connected to network:", network.name);

    initialSetup();

    console.log("Waiting for swap events...");

    while (true) {
        await new Promise(r => setTimeout(r, 5000)); // confirm that events would not wait for this promise to hit.
    }
}

main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
