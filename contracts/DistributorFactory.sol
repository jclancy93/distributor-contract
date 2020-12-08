pragma solidity ^0.7.4;

import "./Distributor.sol";

contract DistributorFactory {

    address coverAddress;
    address nxmTokenAddress;

    constructor (address _coverAddress, address _nxmTokenAddress) {
        coverAddress = _coverAddress;
        nxmTokenAddress = _nxmTokenAddress;
    }

    function newDistributor(uint _feePercentage) public returns (address newContract) {
        Distributor d = new Distributor(coverAddress, nxmTokenAddress, _feePercentage);
        d.transferOwnership(msg.sender);
        return address(d);
    }
}
