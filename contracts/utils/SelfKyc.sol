pragma solidity ^0.7.4;

import "../interfaces/IMemberRoles.sol";

contract SelfKyc {
    IMemberRoles public memberRoles;

    constructor(IMemberRoles _memberRoles) public {
        memberRoles = _memberRoles;
    }

    function joinMutual(address payable member) external payable {
        memberRoles.payJoiningFee{value: msg.value }(member);
        memberRoles.kycVerdict(member, true);
    }

    function approveKyc(address payable member) external payable {
        memberRoles.kycVerdict(member, true);
    }
}
