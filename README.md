# Arbitrage Bot
Trading bot that utilizes Solidity contracts, in conjunction with decentralized exchanges, to execute token arbitrage opportunities on any EVM compatible blockchain. 

## Technologies
Javascript/Node.js, Solidity, Hardhat, Ethers.js, Waffle. 

## Setup
1. Install Node.js if needed.
2. ```npm install``` should install needed dependencies to the ```node_modules``` folder. Confirm with ```npx hardhat compile```.
3. You're able to run tests against an ephemeral local network using ```npx hardhat test```.
4. To spin up a persistent local network forked off mainnet, first create an https://www.alchemy.com/ account, and copy the api key to ```.env```.
5. Next, run ```npx hardhat node```.
6. In a separate terminal, you can run scripts against this local network using hardhat CLI, example: ```npx hardhat run script.js --network localhost```
7. If desired to run a script against an ephemeral network, leave out ```--network localhost```.
8. Determine if ```bot.js``` should be ran with Node.js or hardhat to properly talk with the local network. 
 
## Design

## Tests
Each .js file in ```Tests``` serves a uniqie purpose, and allowed for test driven development. 

```LocalPriceManipulationTests.js```: First forks the Ethereum network, specified by a block in the hardhat configuration file. This is achieved via the Alchemy API. We then execute a JSON RPC to the local hardhat test provider to impersonate a specific ethereum account; a whale with enough relevant ERC20 tokens to manipulate the price of a token pair on a DEX contract already deployed to our local test network. The manipulation of price by dumping a large amount of tokens is tested and verified. Note, this functionality is only used to create arbitrage opportunities within a local testing environment.     

```ArbitrageTests.js```: Verifies functionality for the arbitrage contract, and how it interacts with the DYDX DEX contract. In progress...

```botTests.js```: Verifies that the arb bot detects and appropriately acts on arbitrage opportunities as they arise. In progress...

## TODOs
 - Once all the below points are completed.. Make a new JS module (gitignored!) which will contain arb strategies that should not be shared ;)
 - Watch or attend flash loan masterclass, see where it can be applied to this proj
 - Finish porting over web3 refs to ethers. Unit test solidity code, and some of bot.js functionality. 
 - Split out solidity code into multiple files. 
 - Consider using front-end template here https://github.com/NomicFoundation/hardhat-hackathon-boilerplate/tree/master/frontend
 - Research new stategies, create modular scripts for each blockchain, implement bot for DEXs on AVAX/FTM/MATIC, etc. 
 - Neat React front-end
 - Find inspiration for data pipelines
 - Learn about hardhat tasks, see where they'd have use here. 
 - Write up TDD here and setup instructions, maybe draw out FSM, write out proper workflow of setting up arb in simulation, executing bot, etc. 
 - Ideally make this super portable for new DEXs
