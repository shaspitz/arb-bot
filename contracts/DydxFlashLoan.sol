// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// These lib definitions are taken across multiple dydx contracts for use with the arb bot.

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
        Deposit, // supply tokens
        Withdraw, // borrow tokens
        Transfer, // transfer balance between accounts
        Buy, // buy an amount of some token (externally)
        Sell, // sell an amount of some token (externally)
        Trade, // trade tokens against another account
        Liquidate, // liquidate an undercollateralized or expiring account
        Vaporize, // use excess tokens to zero-out a completely negative account
        Call // send arbitrary data to an address
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
        address owner; // The address that owns the account
        uint256 number; // A nonce that allows a single address to control many accounts
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
