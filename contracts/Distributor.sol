pragma solidity ^0.5.17;

import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/QuotationData.sol";
import "./NXMClient.sol";


contract Distributor is
  ERC721Full("NXMDistributorNFT", "NXMDNFT"),
  Ownable,
  ReentrancyGuard {

  using NXMClient for NXMClient.Data;

  struct Token {
    uint expirationTimestamp;
    bytes4 coverCurrency;
    uint coverAmount;
    uint coverPrice;
    uint coverPriceNXM;
    uint expireTime;
    uint generationTime;
    uint coverId;
    bool claimInProgress;
    uint claimId;
  }

  event PayoutReceived (
    address sender,
    uint value,
    bytes4 currency
  );

  event ClaimRedeemed (
    address receiver,
    uint value,
    bytes4 currency
  );

  bytes4 internal constant ethCurrency = "ETH";

  NXMClient.Data nxmClient;
  uint public priceLoadPercentage;
  uint256 internal issuedTokensCount;
  mapping(uint256 => Token) public tokens;

  mapping(bytes4 => uint) public withdrawableTokens;

  constructor(address _masterAddress, uint _priceLoadPercentage) public {
    priceLoadPercentage = _priceLoadPercentage;
    nxmClient.initialize(_masterAddress);
  }

  function buyCover(
        address coveredContractAddress,
        bytes4 coverCurrency,
        uint[] memory coverDetails,
        uint16 coverPeriod,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
  )
     public
     payable
  {

    uint coverPrice = coverDetails[1];
    uint requiredValue = priceLoadPercentage.mul(coverPrice).div(100).add(coverPrice);
    if (coverCurrency == "ETH") {
      require(msg.value == requiredValue, "Incorrect value sent");
    } else {
      IERC20 erc20 = IERC20(nxmClient.getCurrencyAssetAddress(coverCurrency));
      require(erc20.transferFrom(msg.sender, address(this), requiredValue), "Transfer failed");
    }

    uint coverId = nxmClient.buyCover(coveredContractAddress, coverCurrency, coverDetails, coverPeriod, _v, _r, _s);

    withdrawableTokens[ethCurrency] = withdrawableTokens[ethCurrency].add(requiredValue.sub(coverPrice));


    // mint token
    uint256 lockTokenTimeAfterCoverExpiry = nxmClient.getLockTokenTimeAfterCoverExpiry();
    uint256 nextTokenId = issuedTokensCount++;
    uint expirationTimestamp = block.timestamp + lockTokenTimeAfterCoverExpiry + coverPeriod * 1 days;
    tokens[nextTokenId] = Token(expirationTimestamp,
      coverCurrency,
      coverDetails[0],
      coverDetails[1],
      coverDetails[2],
      coverDetails[3],
      coverDetails[4],
      coverId, false, 0);
    _mint(msg.sender, nextTokenId);
  }

  function submitClaim(
    uint256 tokenId
  )
    public
    onlyTokenApprovedOrOwner(tokenId)
  {
    require(!tokens[tokenId].claimInProgress, "Claim already in progress");
    require(tokens[tokenId].expirationTimestamp > block.timestamp, "Token is expired");

    uint claimId = nxmClient.submitClaim(tokens[tokenId].coverId);

    tokens[tokenId].claimInProgress = true;
    tokens[tokenId].claimId = claimId;
  }


  function redeemClaim(
    uint256 tokenId
  )
    public
    onlyTokenApprovedOrOwner(tokenId)
    nonReentrant
  {
    require(tokens[tokenId].claimInProgress, "No claim is in progress");
    uint8 coverStatus;
    uint sumAssured;
    (, coverStatus, sumAssured, , ) = nxmClient.getCover(tokens[tokenId].coverId);

    require(coverStatus == uint8(QuotationData.CoverStatus.ClaimAccepted), "Claim is not accepted");
    require(nxmClient.payoutIsCompleted(tokens[tokenId].coverId), "Claim accepted but payout not completed");

    _burn(tokenId);
    _sendAssuredSum(tokens[tokenId].coverCurrency, sumAssured);
    emit ClaimRedeemed(msg.sender, sumAssured, tokens[tokenId].coverCurrency);
  }

  function _sendAssuredSum(
    bytes4 coverCurrency,
    uint sumAssured
    )
    internal
  {
    if (coverCurrency == ethCurrency) {
      msg.sender.transfer(sumAssured);
    } else {
      IERC20 erc20 = IERC20(nxmClient.getCurrencyAssetAddress(coverCurrency));
      require(erc20.transfer(msg.sender, sumAssured), "Transfer failed");
    }
  }

  function nxmTokenApprove(address _spender, uint256 _value)
  public
  onlyOwner
  {
    IERC20 nxmToken = IERC20(nxmClient.getTokenAddress());
    nxmToken.approve(_spender, _value);
  }

  function withdrawEther(address payable _recipient, uint256 _amount)
    external
    onlyOwner
    nonReentrant
  {
    require(withdrawableTokens[ethCurrency] >= _amount, "Not enough ETH");
    withdrawableTokens[ethCurrency] = withdrawableTokens[ethCurrency].sub(_amount);
    _recipient.transfer(_amount);
  }

  function withdrawTokens(address payable _recipient, uint256 _amount, bytes4 _currency)
    external
    onlyOwner
    nonReentrant
  {
    require(withdrawableTokens[_currency] >= _amount, "Not enough tokens");
    withdrawableTokens[_currency] = withdrawableTokens[_currency].sub(_amount);

    IERC20 erc20 = IERC20(nxmClient.getCurrencyAssetAddress(_currency));
    require(erc20.transfer(_recipient, _amount), "Transfer failed");
  }

  function sellNXMTokens(uint amount)
    external
    onlyOwner
  {
    uint ethValue = nxmClient.sellNXMTokens(amount);
    withdrawableTokens[ethCurrency] = withdrawableTokens[ethCurrency].add(ethValue);
  }

  modifier onlyTokenApprovedOrOwner(uint256 tokenId) {
    require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved or owner");
    _;
  }

  function () payable external {
    emit PayoutReceived(msg.sender, msg.value, ethCurrency);
  }
}
