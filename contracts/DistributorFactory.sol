pragma solidity ^0.7.4;

import "./Distributor.sol";
import "./interfaces/INXMaster.sol";
import "./interfaces/IMemberRoles.sol";

contract DistributorFactory {

    address coverAddress;

    INXMaster master;

    constructor (address masterAddress) {
        master = INXMaster(masterAddress);
    }

    function newDistributor(uint _feePercentage) public payable returns (address newContract) {

        IMemberRoles memberRoles = IMemberRoles(master.getLatestAddress("MR"));
        Distributor d = new Distributor(master.getLatestAddress("CO"), master.tokenAddress(), _feePercentage);
        d.transferOwnership(msg.sender);
        memberRoles.payJoiningFee{ value: msg.value}(address(d));
        return address(d);
    }
}
