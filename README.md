# Arbitrage Bot
Trading bot that utilizes custom Solidity contracts, in conjunction with decentralized exchange contracts, to execute token arbitrage opportunities on any EVM compatible blockchain. 

## Technologies
Javascript/Node.js, Solidity, Hardhat, Ethers.js, Waffle. 

## Setup

### Create an .env file
Before running any scripts, you'll want to create a .env file with the following values (see .env.example):

- **ALCHEMY_API_KEY=""**
- **ARB_FOR="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"** (By default we are using WETH)
- **ARB_AGAINST="0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE"** (By default we are using SHIB)
- **ACCOUNT=""** (Account to recieve profit/execute arbitrage contract)
- **PRICE_DIFFERENCE=0.50** (Difference in price between Uniswap & Sushiswap, default is 0.50%)
- **UNITS=0** (Only used for price reporting)
- **GAS_LIMIT=600000** (Currently a hardcoded value, may need to adjust during testing)
- **GAS_PRICE=0.0093** (Currently a hardcoded value, may need to adjust during testing)

### About config.json
Inside the *config.json* file, under the PROJECT_SETTINGS object, there are 2 keys that hold a boolean value:
- isLocal
- shouldExecuteTrade

isLocal: Whether bot should monitor a local hardhat netowork for arb opportunities. If false, the bot will monitor mainnet. 

shouldExecuteTrade: Whether the bot should execute a trade on the custom contract if an arb opportunity is found. This is helpful if you want to monitor mainnet for arb opportunities, but don'
t yet have a contract deployed. 

### Local Testing
1. Install Node.js if needed.
2. ```npm install``` should install needed dependencies to the ```node_modules``` folder. Confirm with ```npx hardhat compile```.
3. You're able to run tests against an ephemeral local network using ```npx hardhat test```.
4. To spin up a persistent local network forked off mainnet, first create an https://www.alchemy.com/ account, and copy the api key to ```.env```.
5. Next, run ```npx hardhat node```.
6. In a separate terminal, you can run scripts against this local network using hardhat CLI, example: ```npx hardhat run script.js --network localhost```
7. If desired to run a script against an ephemeral network, leave out ```--network localhost```.
8. Determine if ```bot.js``` should be ran with Node.js or hardhat to properly talk with the local network. 
 
## Design

### Anatomy of bot.js -- TODO: update from recent refactors
The bot is essentially composed of 5 functions.
- *main()*
- *checkPrice()*
- *determineDirection()*
- *determineProfitability()*
- *executeTrade()*

The *main()* function monitors swap events from both Uniswap & Sushiswap. 

When a swap event occurs, it calls *checkPrice()*, this function will log the current price of the assets on both Uniswap & Sushiswap, and return the **priceDifference**

Then *determineDirection()* is called, this will determine where we would need to buy first, then sell. This function will return an array called **routerPath** in *main()*. The array contains Uniswap & Sushiswap's router contracts. If no array is returned, this means the **priceDifference** returned earlier is not higher than **difference**

If **routerPath** is not null, then we move into *determineProfitability()*. This is where we set our conditions on whether there is a potential arbitrage or not. This function returns either true or false.

If true is returned from *determineProfitability()*, then we call *executeTrade()* where we make our call to our arbitrage contract to perform the trade. Afterwards a report is logged, and the bot resumes to monitoring for swap events.

### Simple Strategy Overview
The first-pass strategy implemented is only a simple example that goes along with the local price manipulation script. Essentially, after we manipulate price on Uniswap, we look at the reserves on Sushiswap and determine how much SHIB we need to buy on Uniswap to 'clear' out reserves on Sushiswap. Therefore the arbitrage direction is Uniswap -> Sushiswap. 

If arbitrage direction is opposite, this strategy can fall apart. At least in the case that Sushiswap has lower reserves than uniswap. TODO: this can prob be fixed with a simple check.

## Tests
Each .js file in ```Tests``` serves a uniqie purpose, and allowed for test driven development. 

```LocalPriceManipulationTests.js```: First forks the Ethereum network, specified by a block in the hardhat configuration file. This is achieved via the Alchemy API. We then execute a JSON RPC to the local hardhat test provider to impersonate a specific ethereum account; a whale with enough relevant ERC20 tokens to manipulate the price of a token pair on a DEX contract already deployed to our local test network. The manipulation of price by dumping a large amount of tokens is tested and verified. Note, this functionality is only used to create arbitrage opportunities within a local testing environment.     

```ArbitrageTests.js```: Verifies functionality for the arbitrage contract, and how it interacts with various deployed contracts. In progress...

```BotTests.js```: Verifies that the arb bot detects and appropriately acts on arbitrage opportunities as they arise. In progress...

## TODOs
 - Once all the below points are completed.. Make a new JS module (gitignored!) which will contain arb strategies that should not be shared ;)
 - In general, maybe even future contract code should be kept private, disallowing people front running hard earned arb
 - Understand bot.js more, and fully port over the entire script and helpers. Mainly, need to figure out how to determine "FlashAmount". In the unit tests for arb, the flash amount is essentially arbitrary. How do we choose that value? 
 - Make bot.js consider more than just swaps between two hardcoded token addresses.
- make unit tests for basic functionality of bot.js. Try to brainstorm how that module could be portable for different (private) arb strategies.
 - setup deploy script for actual deployments, make it easy to deploy to different chains, see https://docs.ethers.io/v5/api/contract/example/#example-erc-20-contract--deploying-a-contract
 - Watch or attend flash loan masterclass, see where it can be applied to this proj
 - Finish porting over web3 refs to ethers. Unit test more and more of bot.js functionality. 
 - Research new stategies, create modular scripts for each blockchain, implement bot for DEXs on AVAX/FTM/MATIC, etc. 
 - Learn about hardhat tasks, see where they'd have use here. 
 - Write up TDD here and setup instructions, maybe draw out FSM, write out proper workflow of setting up arb in simulation, executing bot, etc. 
 - Ideally make this super portable for new DEXs
