/* Copyright (C) 2021 NexusMutual.io

  This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

  This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
    along with this program.  If not, see http://www.gnu.org/licenses/ */

pragma solidity ^0.7.4;

interface ICover {

    function buyCover (
        address contractAddress,
        address coverAsset,
        uint sumAssured,
        uint16 coverPeriod,
        uint8 coverType,
        bytes calldata data
    ) external payable returns (uint);

    function getCoverPrice (
        address contractAddress,
        address coverAsset,
        uint sumAssured,
        uint16 coverPeriod,
        uint8 coverType,
        bytes calldata data
    ) external view returns (uint coverPrice);

    function submitClaim(uint coverId, bytes calldata data) external returns (uint);

    function getPayoutOutcome(uint coverId, uint claimId) external view returns (bool completed, uint paidAmount, address asset);

    function executeCoverAction(uint tokenId, uint8 action, bytes calldata data) external payable returns (bytes memory, uint);

    function switchMembership(address _newAddress) external payable;
}
