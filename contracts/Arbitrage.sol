// SPDX-License-Identifier: MIT
pragma solidity ^ 0.8.0;

import "hardhat/console.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./FlashLoan.sol";

// TODO: unit test the beans outta this contract and "FlashLoan"

contract Arbitrage is FlashLoan {

    IUniswapV2Router02 public immutable sRouter;
    IUniswapV2Router02 public immutable uRouter;

    // Deployer of the contract, meaning profit will goto this account no matter who calls the arb function!
    address public owner;

    constructor(address _sRouter, address _uRouter) {
        sRouter = IUniswapV2Router02(_sRouter); // Sushiswap.
        uRouter = IUniswapV2Router02(_uRouter); // Uniswap.
        owner = msg.sender;
    }

    modifier onlySoloMargin() {
        require(
            msg.sender == address(soloMargin),
            "FlashLoan: could be called by solo margin contract only"
        );
        _;
    }

    function executeTrade(
        bool _startOnUniswap,
        address _token0,
        address _token1,
        uint256 _flashAmount
    ) external {
        uint256 balanceBefore = IERC20(_token0).balanceOf(address(this));

        // Arguments passed to dydx contract for use in "callFunction". 
        bytes memory data = abi.encode(
            _startOnUniswap,
            _token0,
            _token1,
            _flashAmount,
            balanceBefore
        );

        flashLoan(_token0, _flashAmount, data); // execution will goto "callFunction".
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

        require(
            balanceAfter - balanceBefore == flashAmount,
            "Loan has failed!"
        );

        // We now have the flashloan, use the money here!
        address[] memory path = new address[](2);

        path[0] = token0;
        path[1] = token1;

        // TODO: these are same functions, just diff addresses, make more modular. 

        if (startOnUniswap) {
            _swapOnUniswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnSushiswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + 1)
            );
        } else {
            _swapOnSushiswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnUniswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + 1)
            );
        }

        IERC20(token0).transfer(
            owner,
            IERC20(token0).balanceOf(address(this)) - (flashAmount + 1)
        );
    }

    // Internal functions.

    function _swapOnUniswap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_path[0]).approve(address(uRouter), _amountIn),
            "Uniswap approval failed."
        );

        uRouter.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _path,
            address(this),
            (block.timestamp + 1200)
        );
    }

    function _swapOnSushiswap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_path[0]).approve(address(sRouter), _amountIn),
            "Sushiswap approval failed."
        );

        sRouter.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _path,
            address(this),
            (block.timestamp + 1200)
        );
    }
}
