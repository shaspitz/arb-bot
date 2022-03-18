// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// These lib definitions are taken across multiple dydx contracts for use with the arb bot.
// Inspiration was also gained from https://gist.github.com/cryptoscopia/1156a368c19a82be2d083e04376d261e,
// although this file differs in some ways.

library Types {
    enum AssetDenomination {
        Wei // the amount is denominated in wei
    }
    enum AssetReference {
        Delta // the amount is given as a delta from the current value
    }
    struct AssetAmount {
        bool sign; // true if positive
        AssetDenomination denomination;
        AssetReference ref;
        uint256 value;
    }
}

library Account {
    struct Info {
        address owner;
        uint256 number;
    }
}

library Actions {
    enum ActionType {
        Deposit, // supply tokens.
        Withdraw, // borrow tokens.
        Transfer, // transfer balance between accounts.
        Buy, // buy an amount of some token (externally).
        Sell, // sell an amount of some token (externally).
        Trade, // trade tokens against another account.
        Liquidate, // liquidate an undercollateralized or expiring account.
        Vaporize, // use excess tokens to zero-out a completely negative account.
        Call // send arbitrary data to an address.
    }
    struct ActionArgs {
        ActionType actionType;
        uint256 accountId;
        Types.AssetAmount amount;
        uint256 primaryMarketId;
        uint256 secondaryMarketId;
        address otherAddress;
        uint256 otherAccountId;
        bytes data;
    }
    struct Info {
        address owner; // The address that owns the account.
        uint256 number; // A nonce that allows a single address to control many accounts.
    }
}

// Interface for the solo margin contract deployed as https://etherscan.io/address/0x1e0447b19bb6ecfdae1e4ae1694b0c3659614e4e#code.
interface ISoloMargin {
    function operate(Account.Info[] memory accounts, Actions.ActionArgs[] memory actions) external;
}

// Interface for a contract to be callable after receiving a flash loan from the solo margin contract.
interface ICallee {
    function callFunction(address sender, Account.Info memory accountInfo, bytes memory data) external;
}

abstract contract FlashLoan is ICallee {
    // The main dydx Solo Margin contract, abi:
    // https://github.com/dydxprotocol/solo/blob/master/migrations/deployed.json
    ISoloMargin public soloMargin = ISoloMargin(0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e);

    address private wrappedEthAddress = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    mapping(address => uint256) private tokenToMarketId;

    // Fee for flash loan through DYDX, in smallest decimal amount of relevant token.
    // See: https://ethereumdev.io/making-a-flash-loan-with-solidity-aave-dy-dx-kollateral/
    // for fee comparisons.
    uint internal constant flashLoanFee = 2;

    constructor() {
        // Hardcode relevant market ids, add one to prevent the mapping returning default value of 0. 
        tokenToMarketId[wrappedEthAddress] = 0 + 1;
    }

    function getMarketId(address token) public view returns (uint256) {
        uint256 marketId = tokenToMarketId[token];
        require(marketId != 0, "Unsupported token!");
        return marketId - 1;
    }
    
    /*
    The flash loan functionality in dydx is predicated by their "operate" function,
    which takes a list of operations to execute, and defers validating the state of
    things until it's done executing them.
    
    We thus create three operations, a Withdraw (which loans us the funds), a Call
    (which invokes the callFunction method on this contract), and a Deposit (which
    repays the loan, plus the 2 wei fee), and pass them all to "operate".
    
    Note that the Deposit operation will invoke the transferFrom to pay the loan 
    (or whatever amount it was initialised with) back to itself, there is no need
    to pay it back explicitly.
    
    The loan must be given as an ERC-20 token, their index can be looked up by
    calling getMarketTokenAddress on the solo margin contract, and set as the 
    primaryMarketId in the Withdraw and Deposit definitions. I've hardcoded a mapping for this.
    */
    function flashLoan(
        address token, 
        uint256 loanAmount,
        bytes memory data
    ) internal {
        console.log("Flash loan has started");

        // First give approval for dydx contract to pay loan back to itself. 
        IERC20(token).approve(address(soloMargin), loanAmount + flashLoanFee); 

        // We will pass three operations to flash loan contract.
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](3);

        // Populate withdraw action.
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: loanAmount 
            }),
            primaryMarketId: getMarketId(token), 
            secondaryMarketId: 0,
            otherAddress: address(this),
            otherAccountId: 0,
            data: ""
        });
        
        // Populate call action, pass neccessary data. 
        actions[1] = Actions.ActionArgs({
            actionType: Actions.ActionType.Call,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: 0
            }),
            primaryMarketId: getMarketId(token), 
            secondaryMarketId: 0,
            otherAddress: address(this),
            otherAccountId: 0,
            data: data // This is where arbitrary data can be sent to callback.
        });
        
        // Populate deposit action, ERC20 approval given above. 
        actions[2] = Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            accountId: 0,
            amount: Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: loanAmount + 2  
            }),
            primaryMarketId: getMarketId(token), 
            secondaryMarketId: 0,
            otherAddress: address(this),
            otherAccountId: 0,
            data: ""
        });

        Account.Info[] memory accountInfos = new Account.Info[](1); 
        accountInfos[0] = Account.Info({owner: address(this), number: 1}); 

        // Solo margin contract will call "callFunction" as defined by inheriting contracts during "operate". 
        soloMargin.operate(accountInfos, actions);
    }
}