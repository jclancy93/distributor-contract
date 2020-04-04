/* Copyright (C) 2017 NexusMutual.io

  This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General external License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

  This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General external License for more details.

  You should have received a copy of the GNU General external License
    along with this program.  If not, see http://www.gnu.org/licenses/ */

pragma solidity 0.5.7;

interface DSValue {
    function peek() external view returns (bytes32, bool);
    function read() external view returns (bytes32);
}


interface PoolData {

    struct ApiId {
        bytes4 typeOf;
        bytes4 currency;
        uint id;
        uint64 dateAdd;
        uint64 dateUpd;
    }

    struct CurrencyAssets {
        address currAddress;
        uint baseMin;
        uint varMin;
    }

    struct InvestmentAssets {
        address currAddress;
        bool status;
        uint64 minHoldingPercX100;
        uint64 maxHoldingPercX100;
        uint8 decimals;
    }

    struct IARankDetails {
        bytes4 maxIACurr;
        uint64 maxRate;
        bytes4 minIACurr;
        uint64 minRate;
    }

    struct McrData {
        uint mcrPercx100;
        uint mcrEther;
        uint vFull; //Pool funds
        uint64 date;
    }

    /**
     * @dev to set the maximum cap allowed
     * @param val is the new value
     */
    function setCapReached(uint val) external;

    /**
     * @dev Gets investment asset decimals.
     */
    function getInvestmentAssetDecimals(bytes4 curr) external returns(uint8 decimal);

    /**
     * @dev Gets Currency asset token address.
     */
    function getCurrencyAssetAddress(bytes4 curr) external view returns(address);

    /**
     * @dev Gets investment asset token address.
     */
    function getInvestmentAssetAddress(bytes4 curr) external view returns(address);

    /**
     * @dev Gets investment asset active Status of a given currency.
     */
    function getInvestmentAssetStatus(bytes4 curr) external view returns(bool status);

}
