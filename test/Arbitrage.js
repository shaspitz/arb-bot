const { expect } = require("chai");

describe("Arbitrage contract", function () {
  it("Need to write some tests", async function () {
    const [owner] = await ethers.getSigners();

    const contract = await ethers.getContractFactory("DyDxFlashLoan");

    const hardhatToken = await contract.deploy();

    expect(true);

    // const ownerBalance = await hardhatToken.balanceOf(owner.address);
    // expect(await hardhatToken.totalSupply()).to.equal(ownerBalance);
  });
});