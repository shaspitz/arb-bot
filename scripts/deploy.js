// See https://hardhat.org/guides/deploying.html and/or https://github.com/wighawag/hardhat-deploy#1-namedaccounts-ability-to-name-addresses,
// or https://www.youtube.com/watch?v=Uvphp4aVeDg&ab_channel=MoralisWeb3
// Simple explanation on why we only need to pass the private key: https://ethereum.stackexchange.com/questions/3542/how-are-ethereum-addresses-generated

async function main() {
    if (network.name === "hardhat") {
      console.warn(
        "You are trying to deploy a contract to the Hardhat Network, which" +
          " gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }
  
    // ethers is available in the global scope
    // will have to look into how signers are retrieved here.
    // For hardhat local network, I think signers are just given automatically. 
    // For mainnet, prob have to store private key in gitignored file.  
    const [deployer] = await ethers.getSigners();
    console.log(
      "Deploying the contracts with the account:",
      await deployer.getAddress()
    );
  
    console.log("Account balance:", (await deployer.getBalance()).toString());
  
    const flashLoanContract = await ethers.getContractFactory("DyDxFlashLoan");
    // With hardhat-ethers plugin, contract is deployed by first signer by default.
    const deployedContract = await flashLoanContract.deploy();
  
    console.log("contract address:", deployedContract.address);
  
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
