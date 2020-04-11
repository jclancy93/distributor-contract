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

interface Claims {

    /**
     * @dev Gets details of a given claim id.
     * @param _claimId Claim Id.
     * @return status Current status of claim id
     * @return finalVerdict Decision made on the claim, 1 -> acceptance, -1 -> denial
     * @return claimOwner Address through which claim is submitted
     * @return coverId Coverid associated with the claim id
     */
    function getClaimbyIndex(uint _claimId) external view returns (
        uint claimId,
        uint status,
        int8 finalVerdict,
        address claimOwner,
        uint coverId
    );

    /**
     * @dev Submits a claim for a given cover note.
     * Adds claim to queue incase of emergency pause else directly submits the claim.
     * @param coverId Cover Id.
     */
    function submitClaim(uint coverId) external;

}
