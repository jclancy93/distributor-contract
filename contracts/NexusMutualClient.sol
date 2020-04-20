pragma solidity ^0.5.17;

import "./interfaces/Pool1.sol";
import "./interfaces/INXMMaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/PoolData.sol";
import "./interfaces/QuotationData.sol";
import "./interfaces/TokenData.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/Claims.sol";
import "./interfaces/ClaimsData.sol";
import "./interfaces/NXMToken.sol";
import "./interfaces/TokenData.sol";

library NexusMutualClient {
    using SafeMath for uint;

    struct Data {
        INXMMaster nxMaster;
    }

    enum CoverStatus {
        Active,
        ClaimAccepted,
        ClaimDenied,
        CoverExpired,
        ClaimSubmitted,
        Requested
    }

    enum ClaimStatus {
        PendingClaimAssessorVote, // 0
        PendingClaimAssessorVoteDenied, // 1
        PendingClaimAssessorVoteThresholdNotReachedAccept, // 2
        PendingClaimAssessorVoteThresholdNotReachedDeny, // 3
        PendingClaimAssessorConsensusNotReachedAccept, // 4
        PendingClaimAssessorConsensusNotReachedDeny, // 5
        FinalClaimAssessorVoteDenied, // 6
        FinalClaimAssessorVoteAccepted, // 7
        FinalClaimAssessorVoteDeniedMVAccepted, // 8
        FinalClaimAssessorVoteDeniedMVDenied, // 9
        FinalClaimAssessorVotAcceptedMVNoDecision, // 10
        FinalClaimAssessorVoteDeniedMVNoDecision, // 11
        ClaimAcceptedPayoutPending, // 12
        ClaimAcceptedNoPayout, // 13
        ClaimAcceptedPayoutDone // 14
    }

    function initialize(Data storage data, address masterAddress) internal {
        data.nxMaster = INXMMaster(masterAddress);
    }
    
    function buyCover(
        Data storage data,
        address coveredContractAddress,
        bytes4 coverCurrency,
        uint[] memory coverDetails,
        uint16 coverPeriod,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal returns (uint coverId) {

        uint coverPrice = coverDetails[1];
        Pool1 pool1 = Pool1(data.nxMaster.getLatestAddress("P1"));
        if (coverCurrency == "ETH") {
            pool1.makeCoverBegin.value(coverPrice)(coveredContractAddress, coverCurrency, coverDetails, coverPeriod, _v, _r, _s);
        } else {
            address payable pool1Address = address(uint160(address(pool1)));
            PoolData poolData = PoolData(data.nxMaster.getLatestAddress("PD"));
            IERC20 erc20 = IERC20(poolData.getCurrencyAssetAddress(coverCurrency));
            erc20.approve(pool1Address, coverPrice);
            pool1.makeCoverUsingCA(coveredContractAddress, coverCurrency, coverDetails, coverPeriod, _v, _r, _s);
        }

        QuotationData quotationData = QuotationData(data.nxMaster.getLatestAddress("QD"));
        // *assumes* the newly created claim is appended at the end of the list covers
        coverId = quotationData.getCoverLength().sub(1);
    }

    function submitClaim(Data storage data, uint coverId) internal returns (uint) {
        Claims claims = Claims(data.nxMaster.getLatestAddress("CL"));
        claims.submitClaim(coverId);

        ClaimsData claimsData = ClaimsData(data.nxMaster.getLatestAddress("CD"));
        uint claimId = claimsData.actualClaimLength() - 1;
        return claimId;
    }

    function getCover(
        Data storage data,
        uint coverId
    ) internal view returns (
        uint cid,
        uint8 status,
        uint sumAssured,
        uint16 coverPeriod,
        uint validUntil
    ) {
        QuotationData quotationData = QuotationData(data.nxMaster.getLatestAddress("QD"));
        return quotationData.getCoverDetailsByCoverID2(coverId);
    }

    function sellNXMTokens(Data storage data, uint amount) internal returns (uint ethValue) {
        address payable pool1Address = data.nxMaster.getLatestAddress("P1");
        Pool1 p1 = Pool1(pool1Address);

        NXMToken nxmToken = NXMToken(data.nxMaster.tokenAddress());

        ethValue = p1.getWei(amount);
        nxmToken.approve(pool1Address, amount);
        p1.sellNXMTokens(amount);
    }

    function getCurrencyAssetAddress(Data storage data, bytes4 currency) internal view returns (address) {
        PoolData pd = PoolData(data.nxMaster.getLatestAddress("PD"));
        return pd.getCurrencyAssetAddress(currency);
    }

    function getLockTokenTimeAfterCoverExpiry(Data storage data) internal returns (uint) {
        TokenData tokenData = TokenData(data.nxMaster.getLatestAddress("TD"));
        return tokenData.lockTokenTimeAfterCoverExp();
    }

    function getTokenAddress(Data storage data) internal view returns (address) {
        return data.nxMaster.tokenAddress();
    }

    function payoutIsCompleted(Data storage data, uint claimId) internal view returns (bool) {
        uint256 status;
        Claims claims = Claims(data.nxMaster.getLatestAddress("CL"));
        (, status, , , ) = claims.getClaimbyIndex(claimId);
        return status == uint(ClaimStatus.FinalClaimAssessorVoteAccepted)
            || status == uint(ClaimStatus.ClaimAcceptedPayoutDone);
    }
}
