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
 
 ## TODOs
 - Finish porting over web3 refs to ethers. Unit test solidity code, and some of bot.js functionality. 
 - Split out solidity code into multiple files. 
 - Consider using front-end template here https://github.com/NomicFoundation/hardhat-hackathon-boilerplate/tree/master/frontend
 - Research new stategies, create modular scripts for each blockchain, implement bot for DEXs on AVAX/FTM/MATIC, etc. 
 - Neat React front-end
 - Find inspiration for data pipelines
 - refactor given code to be OOP based
 - Write up TDD here and setup instructions, maybe draw out FSM 
 - Ideally make this super portable for new DEXs
