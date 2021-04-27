import "../../nexusmutual-contracts/contracts/modules/cover/Gateway.sol";

contract CoverWithClaimTax is Gateway {

    // always pay your taxes
    uint public constant CLAIM_TAX_DAI = 50 ether;

    /**
    * support DAI tax
    *
    */
    function executeCoverAction(uint coverId, uint8 action, bytes calldata data)
    external
    payable
    returns (bytes memory, uint)
    {
        require(action == 0, "CoverExtended: Unsupported action");

        IERC20 token = IERC20(DAI);
        token.safeTransferFrom(msg.sender, address(this), CLAIM_TAX_DAI);

        claims.submitClaimForMember(coverId, msg.sender);
        uint claimId = claimsData.actualClaimLength() - 1;
        emit ClaimSubmitted(claimId, coverId, msg.sender, data);
        return (abi.encode(claimId), CLAIM_TAX_DAI);
    }
}
