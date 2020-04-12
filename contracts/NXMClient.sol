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

library NXMClient {
    using SafeMath for uint;

    struct Data {
        INXMMaster nxMaster;
    }

    function initialize(Data storage data, address masterAddress) public {
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
    ) public returns (uint coverId) {

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
        coverId = quotationData.getCoverLength().sub(1);
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
    ) public view returns (
        uint claimId,
        uint status,
        int8 finalVerdict,
        address claimOwner,
        uint coverId
    ) {
        Claims claims = Claims(data.nxMaster.getLatestAddress("CL"));
        return claims.getClaimbyIndex(claimIdValue);
    }

    function sellNXMTokens(
        Data storage data,
        uint amount
    ) public returns (
        uint ethValue
    ) {
        address payable pool1Address = data.nxMaster.getLatestAddress("P1");
        Pool1 p1 = Pool1(pool1Address);

        NXMToken nxmToken = NXMToken(data.nxMaster.tokenAddress());

        ethValue = p1.getWei(amount);
        nxmToken.approve(pool1Address, amount);
        p1.sellNXMTokens(amount);
    }

    function getCurrencyAssetAddress(Data storage data, bytes4 currency) public view returns (address) {
        PoolData pd = PoolData(data.nxMaster.getLatestAddress("PD"));
        return pd.getCurrencyAssetAddress(currency);
    }

    function getLockTokenTimeAfterCoverExpiry(Data storage data) public returns (uint) {
        TokenData tokenData = TokenData(data.nxMaster.getLatestAddress("TD"));
        return tokenData.lockTokenTimeAfterCoverExp();
    }

    function getTokenAddress(Data storage data) public view returns (address) {
        return data.nxMaster.tokenAddress();
    }
}
