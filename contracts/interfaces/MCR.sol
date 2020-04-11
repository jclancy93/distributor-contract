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

pragma solidity ^0.5.17;

interface MCR {

    event MCREvent(
        uint indexed date,
        uint blockNumber,
        bytes4[] allCurr,
        uint[] allCurrRates,
        uint mcrEtherx100,
        uint mcrPercx100,
        uint vFull
    );

    /**
     * @dev Adds new MCR data.
     * @param mcrP  Minimum Capital Requirement in percentage.
     * @param vF Pool1 fund value in Ether used in the last full daily calculation of the Capital model.
     * @param onlyDate  Date(yyyymmdd) at which MCR details are getting added.
     */
    function addMCRData(
        uint mcrP,
        uint mcrE,
        uint vF,
        bytes4[] calldata curr,
        uint[] calldata _threeDayAvg,
        uint64 onlyDate
    )
        external;

    /**
     * @dev Adds MCR Data for last failed attempt.
     */
    function addLastMCRData(uint64 date) external;

    /**
     * @dev Iupgradable Interface to update dependent contract address
     */
    function changeDependentContractAddress() external;
    /**
     * @dev Gets total sum assured(in ETH).
     * @return amount of sum assured.
     */
    function getAllSumAssurance() external view returns(uint amount);

    /**
     * @dev Calculates V(Tp) and MCR%(Tp), i.e, Pool Fund Value in Ether
     * and MCR% used in the Token Price Calculation.
     * @return vtp  Pool Fund Value in Ether used for the Token Price Model
     * @return mcrtp MCR% used in the Token Price Model.
     */
    function _calVtpAndMCRtp(uint poolBalance) external returns(uint vtp, uint mcrtp);

    /**
     * @dev Calculates the Token Price of NXM in a given currency.
     * @param curr Currency name.

     */
    function calculateStepTokenPrice(
        bytes4 curr,
        uint mcrtp
    )
        external;

    /**
     * @dev Calculates the Token Price of NXM in a given currency
     * with provided token supply for dynamic token price calculation
     * @param curr Currency name.
     */
    function calculateTokenPrice (bytes4 curr) external view returns(uint tokenPrice);

    function calVtpAndMCRtp() external view returns(uint vtp, uint mcrtp);

    function calculateVtpAndMCRtp(uint poolBalance) external view returns(uint vtp, uint mcrtp);

    function getThresholdValues(uint vtp, uint vF, uint totalSA, uint minCap) external view returns(uint lowerThreshold, uint upperThreshold);

    /**
     * @dev Gets max numbers of tokens that can be sold at the moment.
     */
    function getMaxSellTokens() external view returns(uint maxTokens);

    /**
     * @dev Gets Uint Parameters of a code
     * @param code whose details we want
     * @return string value of the code
     * @return associated amount (time or perc or value) to the code
     */
    function getUintParameters(bytes8 code) external view returns(bytes8 codeVal, uint val);

    /**
     * @dev Updates Uint Parameters of a code
     * @param code whose details we want to update
     * @param val value to set
     */
    function updateUintParameters(bytes8 code, uint val) external;

}
