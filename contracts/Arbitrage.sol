// SPDX-License-Identifier: MIT
pragma solidity ^ 0.8.0;

import "hardhat/console.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./FlashLoan.sol";

// TODO: unit test the beans outta this contract and "FlashLoan"

contract Arbitrage is FlashLoan {

    // See: https://docs.uniswap.org/protocol/V2/reference/smart-contracts/router-02
    IUniswapV2Router02 public immutable sushiSwapRouter;
    IUniswapV2Router02 public immutable uniSwapRouter;

    // Deployer of the contract, meaning profit will goto this account no matter who calls the arb function!
    address public owner;

    // int addeded to current block Unix timestamp, after which DEX swap transaction will revert.
    uint private constant swapDeadline = 1200;

    constructor(address sushiSwapRouterAddress, address uniSwapRouterAddress) { 
        sushiSwapRouter = IUniswapV2Router02(sushiSwapRouterAddress); 
        uniSwapRouter = IUniswapV2Router02(uniSwapRouterAddress); 
        owner = msg.sender;
    }

    modifier onlySoloMargin() {
        require(
            msg.sender == address(soloMargin),
            "FlashLoan: could be called by solo margin contract only"
        );
        _;
    }

    // Bot should call this function when arb trade is detected. 
    function executeTrade(
        bool startOnUniswap, // Whether first swap should be in uniswap.
        address token0, // Start of swap path, flash loan denominated in this token.
        address token1, // Intermediary token.
        uint256 flashAmount // Amount of token0 to borrow.
    ) external {
        uint256 balanceBefore = IERC20(token0).balanceOf(address(this));

        // Arguments passed to dydx contract for use in "callFunction". 
        bytes memory data = abi.encode(
            startOnUniswap,
            token0, 
            token1,
            flashAmount,
            balanceBefore
        );

        flashLoan(token0, flashAmount, data); // execution will goto "callFunction".
    }

    // This is the function called by dydx after giving us the loan.
    function callFunction(
        address, 
        Account.Info memory,  // Unused account info parameter.
        bytes memory data) external override onlySoloMargin {

        // Decode the passed variables from the data object.
        (bool startOnUniswap, address token0, address token1, uint256 flashAmount,
            uint256 balanceBefore)
            = abi.decode(data, (bool, address, address, uint256, uint256));

        uint256 balanceAfter = IERC20(token0).balanceOf(address(this));

        // Sanity check that we recieved the loan.
        require(
            balanceAfter - balanceBefore == flashAmount,
            "Loan has failed!"
        );

        // Set token path for DEX call. See documentation below, path can potentially be > 2 token addresses. 
        address[] memory tokenPath = new address[](2);
        tokenPath[0] = token0;
        tokenPath[1] = token1;

        if (startOnUniswap) {
            // Swap token pair on uniswap first.
            swapOnUniswap(tokenPath, flashAmount, 0);

            // Path is now flipped for other DEX.
            tokenPath[0] = token1;
            tokenPath[1] = token0;

            // Swap back token pair, hoping for profit.
            swapOnSushiswap(
                tokenPath,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + 1) 
            );
        // Same process as above, but starting with SushiSwap.
        } else {
            swapOnSushiswap(tokenPath, flashAmount, 0);

            tokenPath[0] = token1;
            tokenPath[1] = token0;

            swapOnUniswap(
                tokenPath,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + 1)
            );
        }

        // Transfer arb profit to owning account.
        console.log("TODO: determine fee for using the flash loan! 1 or 2? Then make consistent across both contracts");
        IERC20(token0).transfer(
            owner,
            IERC20(token0).balanceOf(address(this)) - (flashAmount + 1)
        );
    }

    // Swaps an exact amount of input tokens for as many output tokens as possible,
    // along given path for Uniswap exchange.
    // Both uniswap and sushiswap implement the "swapExactTokensForTokens" function. 
    // See: https://docs.uniswap.org/protocol/V2/reference/smart-contracts/router-02#swapexacttokensfortokens.
    function swapOnUniswap(
        address[] memory tokenPath,
        uint256 amountIn,
        uint256 amountOut
    ) internal {
        require(
            IERC20(tokenPath[0]).approve(address(uniSwapRouter), amountIn),
            "Uniswap approval failed."
        );

        uniSwapRouter.swapExactTokensForTokens(
            amountIn,
            amountOut,
            tokenPath,
            address(this),
            (block.timestamp + swapDeadline) 
        );
    }
    
    // Swaps an exact amount of input tokens for as many output tokens as possible,
    // along given path for Sushiswap exchange.
    function swapOnSushiswap(
        address[] memory _tokenPath,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_tokenPath[0]).approve(address(sushiSwapRouter), _amountIn),
            "Sushiswap approval failed."
        );

        sushiSwapRouter.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _tokenPath,
            address(this),
            (block.timestamp + swapDeadline) 
        );
    }
}
