// SPDX-License-Identifier: MIT
pragma solidity ^ 0.8.0;

import "hardhat/console.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DydxFlashLoan.sol";

// ! TODO: Use this example to understand the code better
// https://gist.github.com/cryptoscopia/1156a368c19a82be2d083e04376d261e

// TODO: Then comment up the code better. 

contract Arbitrage is ICallee {

    // The main dydx Solo Margin contract, abi:
    // https://github.com/dydxprotocol/solo/blob/master/migrations/deployed.json
    ISoloMargin pool = ISoloMargin(0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e);

    address public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    mapping(address => uint256) public currencies;
    IUniswapV2Router02 public immutable sRouter;
    IUniswapV2Router02 public immutable uRouter;
    address public owner;

    constructor(address _sRouter, address _uRouter) {
        sRouter = IUniswapV2Router02(_sRouter); // Sushiswap.
        uRouter = IUniswapV2Router02(_uRouter); // Uniswap.
        owner = msg.sender;
        currencies[WETH] = 1;
    }

    // ! TODO: Change name of this method. 
    modifier onlyPool() {
        require(
            msg.sender == address(pool),
            "FlashLoan: could be called by solo margin contract only"
        );
        _;
    }

    function tokenToMarketId(address token) public view returns (uint256) {
        console.log("Whoa, hardhat lets me console log from solidity");
        uint256 marketId = currencies[token];
        require(marketId != 0, "FlashLoan: Unsupported token");
        return marketId - 1;
    }

    // DyDx contract will call `callFunction(address sender, Info memory accountInfo, bytes memory data) public` during `operate` call
    function flashloan(
        address token,
        uint256 amount,
        bytes memory data
    ) internal {
        IERC20(token).approve(address(pool), amount + 1);
        Misc.Info[] memory infos = new Misc.Info[](1);
        Actions.ActionArgs[] memory args = new Actions.ActionArgs[](3);

        infos[0] = Misc.Info(address(this), 0);

        Types.AssetAmount memory wamt = Types.AssetAmount(
            false,
            Types.AssetDenomination.Wei,
            Types.AssetReference.Delta,
            amount
        );
        Actions.ActionArgs memory withdraw;
        withdraw.actionType = Actions.ActionType.Withdraw;
        withdraw.accountId = 0;
        withdraw.amount = wamt;
        withdraw.primaryMarketId = tokenToMarketId(token);
        withdraw.otherAddress = address(this);

        args[0] = withdraw;

        Actions.ActionArgs memory call;
        call.actionType = Actions.ActionType.Call;
        call.accountId = 0;
        call.otherAddress = address(this);
        call.data = data;

        args[1] = call;

        Actions.ActionArgs memory deposit;
        Types.AssetAmount memory damt = Types.AssetAmount(
            true,
            Types.AssetDenomination.Wei,
            Types.AssetReference.Delta,
            amount + 1
        );
        deposit.actionType = Actions.ActionType.Deposit;
        deposit.accountId = 0;
        deposit.amount = damt;
        deposit.primaryMarketId = tokenToMarketId(token);
        deposit.otherAddress = address(this);

        args[2] = deposit;

        pool.operate(infos, args);
    }

    function executeTrade(
        bool _startOnUniswap,
        address _token0,
        address _token1,
        uint256 _flashAmount
    ) external {
        uint256 balanceBefore = IERC20(_token0).balanceOf(address(this));

        bytes memory data = abi.encode(
            _startOnUniswap,
            _token0,
            _token1,
            _flashAmount,
            balanceBefore
        );

        flashloan(_token0, _flashAmount, data); // execution goes to `callFunction`.
    }

    // Same as above...
    // ! TODO: Use this example to understand the code better
    // https://gist.github.com/cryptoscopia/1156a368c19a82be2d083e04376d261e


    // This is the function called by dydx after giving us the loan.
    function callFunction(
        address, // Unused address parameter.
        Misc.Info memory,  // Unused account info parameter.
        bytes memory data) external override onlyPool {

        // Decode the passed variables from the data object.
        (bool startOnUniswap, address token0, address token1, uint256 flashAmount,
            uint256 balanceBefore)
            = abi.decode(data, (bool, address, address, uint256, uint256));

        uint256 balanceAfter = IERC20(token0).balanceOf(address(this));

        require(
            balanceAfter - balanceBefore == flashAmount,
            "contract did not get the loan"
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

    // -- INTERNAL FUNCTIONS -- //

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
