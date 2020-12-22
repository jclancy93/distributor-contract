pragma solidity ^0.7.4;

import "./Distributor.sol";
import "./interfaces/INXMaster.sol";
import "./interfaces/IMemberRoles.sol";

contract DistributorFactory {

    address coverAddress;

    INXMaster master;

    event DistributorCreated(
        address contractAddress,
        address owner,
        uint feePercentage
    );

    constructor (address masterAddress) {
        master = INXMaster(masterAddress);
    }

    function newDistributor(
        uint _feePercentage,
        string memory tokenName,
        string memory tokenSymbol
    ) public payable returns (address) {

        IMemberRoles memberRoles = IMemberRoles(master.getLatestAddress("MR"));
        Distributor d = new Distributor(
            master.getLatestAddress("CO"),
            master.tokenAddress(),
            master.getLatestAddress("P1"),
            _feePercentage,
            tokenName,
            tokenSymbol
        );
        d.transferOwnership(msg.sender);
        memberRoles.payJoiningFee{ value: msg.value}(address(d));

        emit DistributorCreated(address(d), msg.sender, _feePercentage);
        return address(d);
    }
}
