pragma solidity ^0.5.17;

import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@nexusmutual/cover-api/contracts/NexusMutualCover.sol";


contract Distributor is
  ERC721Full("NXMDistributorNFT", "NXMDNFT"),
  Ownable,
  ReentrancyGuard {

  using NexusMutualCover for NexusMutualCover.Data;

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

  event ClaimRedeemed (
    address receiver,
    uint value,
    bytes4 currency
  );

  bytes4 internal constant ethCurrency = "ETH";

  NexusMutualCover.Data nexusMutualClient;
  uint public distributorFeePercentage;
  uint256 internal issuedTokensCount;
  mapping(uint256 => Token) public tokens;

  mapping(bytes4 => uint) public withdrawableTokens;

  constructor(address _masterAddress, uint _distributorFeePercentage) public {
    distributorFeePercentage = _distributorFeePercentage;
    nexusMutualClient.setMasterAddress(_masterAddress);
  }

  function buyCover(
        address coveredContractAddress,
        bytes4 coverCurrency,
        uint[] calldata coverDetails,
        uint16 coverPeriod,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
  )
     external
     payable
  {

    uint coverPrice = coverDetails[1];
    uint requiredValue = distributorFeePercentage.mul(coverPrice).div(100).add(coverPrice);
    if (coverCurrency == "ETH") {
      require(msg.value == requiredValue, "Incorrect value sent");
    } else {
      IERC20 erc20 = IERC20(nexusMutualClient.getCurrencyAssetAddress(coverCurrency));
      require(erc20.transferFrom(msg.sender, address(this), requiredValue), "Transfer failed");
    }

    uint coverId = nexusMutualClient.buyCover(coveredContractAddress, coverCurrency, coverDetails, coverPeriod, _v, _r, _s);
    withdrawableTokens[coverCurrency] = withdrawableTokens[coverCurrency].add(requiredValue.sub(coverPrice));

    // mint token
    uint256 nextTokenId = issuedTokensCount++;
    uint expirationTimestamp = block.timestamp + nexusMutualClient.getLockTokenTimeAfterCoverExpiry() + coverPeriod * 1 days;
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
    external
    onlyTokenApprovedOrOwner(tokenId)
  {
    require(!tokens[tokenId].claimInProgress, "Claim already in progress");
    require(tokens[tokenId].expirationTimestamp > block.timestamp, "Token is expired");

    uint claimId = nexusMutualClient.submitClaim(tokens[tokenId].coverId);

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
    (, coverStatus, sumAssured, , ) = nexusMutualClient.getCover(tokens[tokenId].coverId);

    require(coverStatus == uint8(NexusMutualCover.CoverStatus.ClaimAccepted), "Claim is not accepted");
    require(nexusMutualClient.payoutIsCompleted(tokens[tokenId].coverId), "Claim accepted but payout not completed");

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
      IERC20 erc20 = IERC20(nexusMutualClient.getCurrencyAssetAddress(coverCurrency));
      require(erc20.transfer(msg.sender, sumAssured), "Transfer failed");
    }
  }

  function getCoverStatus(uint256 tokenId) external view returns (uint8 coverStatus, bool payoutCompleted) {
    (, coverStatus, , , ) = nexusMutualClient.getCover(tokens[tokenId].coverId);
    payoutCompleted = nexusMutualClient.payoutIsCompleted(tokenId);
  }

  function nxmTokenApprove(address _spender, uint256 _value)
  public
  onlyOwner
  {
    IERC20 nxmToken = IERC20(nexusMutualClient.getTokenAddress());
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

    IERC20 erc20 = IERC20(nexusMutualClient.getCurrencyAssetAddress(_currency));
    require(erc20.transfer(_recipient, _amount), "Transfer failed");
  }

  function sellNXMTokens(uint amount)
    external
    onlyOwner
  {
    uint ethValue = nexusMutualClient.sellNXMTokens(amount);
    withdrawableTokens[ethCurrency] = withdrawableTokens[ethCurrency].add(ethValue);
  }

  modifier onlyTokenApprovedOrOwner(uint256 tokenId) {
    require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved or owner");
    _;
  }

  function () payable external {
  }
}
