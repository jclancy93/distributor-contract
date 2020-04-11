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

library NXMClient {
    using SafeMath for uint;

    struct Data {
        INXMMaster nxMaster;
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
    ) public returns (uint) {

        uint coverPrice = coverDetails[1];
        if (coverCurrency == "ETH") {
            Pool1 p1 = Pool1(data.nxMaster.getLatestAddress("P1"));
            p1.makeCoverBegin.value(coverPrice)(coveredContractAddress, coverCurrency, coverDetails, coverPeriod, _v, _r, _s);
        } else {
            address payable pool1Address = data.nxMaster.getLatestAddress("P1");
            PoolData pd = PoolData(data.nxMaster.getLatestAddress("PD"));
            IERC20 erc20 = IERC20(pd.getCurrencyAssetAddress(coverCurrency));
            erc20.approve(pool1Address, coverPrice);
            Pool1 p1 = Pool1(pool1Address);
            p1.makeCoverUsingCA(coveredContractAddress, coverCurrency, coverDetails, coverPeriod, _v, _r, _s);
        }

        QuotationData quotationData = QuotationData(data.nxMaster.getLatestAddress("QD"));
        // *assumes* the newly created claim is appended at the end of the list covers
        uint coverId = quotationData.getCoverLength().sub(1);
        return coverId;
    }

    function submitClaim(
        Data storage data,
        uint coverId
    ) public returns (uint) {
        Claims claims = Claims(data.nxMaster.getLatestAddress("CL"));
        claims.submitClaim(coverId);

        ClaimsData claimsData = ClaimsData(data.nxMaster.getLatestAddress("CD"));
        uint claimId = claimsData.actualClaimLength() - 1;
        return claimId;
    }

    function getCover(
        Data storage data,
        uint coverId
    ) public returns (
        uint cid,
        uint8 status,
        uint sumAssured,
        uint16 coverPeriod,
        uint validUntil
    ) {
        QuotationData quotationData = QuotationData(data.nxMaster.getLatestAddress("QD"));
        return quotationData.getCoverDetailsByCoverID2(coverId);
    }

    function getClaim(
        Data storage data,
        uint claimIdValue
    ) public returns (
        uint claimId,
        uint status,
        int8 finalVerdict,
        address claimOwner,
        uint coverId
    ) {
        Claims claims = Claims(data.nxMaster.getLatestAddress("CL"));
        return claims.getClaimbyIndex(claimIdValue);
    }
}
