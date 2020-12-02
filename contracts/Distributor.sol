pragma solidity 0.7.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";


contract Distributor is
  ERC721("NXMDistributorNFT", "NXMDNFT"),
  Ownable,
  ReentrancyGuard {
  using SafeMath for uint;
  using SafeERC20 for IERC20;

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

  event ClaimSubmitted (
    uint256 indexed coverId,
    uint256 indexed claimId
  );

  event CoverBought (
    uint indexed coverId,
    address indexed buyer,
    address indexed contractAddress,
    bytes4 asset,
    uint256 coverAmount,
    uint256 coverPrice,
    uint256 startTime,
    uint16 coverPeriod
  );

  bytes4 internal constant ethCurrency = "ETH";

  uint public distributorFeePercentage;
  uint256 internal issuedTokensCount;
  mapping(uint256 => Token) public tokens;

  mapping(bytes4 => uint) public withdrawableTokens;

  constructor(address _masterAddress, uint _distributorFeePercentage) public {
    distributorFeePercentage = _distributorFeePercentage;
    // TODO: set master address
  }

  // Arguments to be passed as coverDetails, from the quote api:
  //    coverDetails[0] = coverAmount;
  //    coverDetails[1] = coverPrice;
  //    coverDetails[2] = coverPriceNXM;
  //    coverDetails[3] = expireTime;
  //    coverDetails[4] = generationTime;
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
      // TODO: erc20 handle
    }


    // TODO: fix
    uint coverId = 0;
    withdrawableTokens[coverCurrency] = withdrawableTokens[coverCurrency].add(requiredValue.sub(coverPrice));

    // mint token
    uint256 nextTokenId = issuedTokensCount++;

    // TODO: fix
    uint expirationTimestamp = 0;
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

    if (tokens[tokenId].claimInProgress) {
      uint8 coverStatus;

      // TODO: fix
      coverStatus = 0;
      // TODO: fix for denied of accepted
      require(coverStatus == 1,
        "Can submit another claim only if the previous one was denied.");
    }
    require(tokens[tokenId].expirationTimestamp > block.timestamp, "Token is expired");

    // TODO: fix
    uint claimId = 0;

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
    // TODO: fix fetching of status and sumAssured

    // TODO: check for status accepted
    require(coverStatus == 1, "Claim is not accepted");

    // TODO: fix
    bool payoutIsCompleted = false;
    require(payoutIsCompleted, "Claim accepted but payout not completed");

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
      // TODO: fix
      IERC20 erc20;
      require(erc20.transfer(msg.sender, sumAssured), "Transfer failed");
    }
  }

  function getCoverStatus(uint256 tokenId) external view returns (uint8 coverStatus, bool payoutCompleted) {
    // TODO: fix
  }

  function nxmTokenApprove(address _spender, uint256 _value)
  public
  onlyOwner
  {
    // TODO: see if it can be done through proxy
    IERC20 nxmToken;
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

    // TODO: fix
    IERC20 erc20;
    require(erc20.transfer(_recipient, _amount), "Transfer failed");
  }

  function sellNXMTokens(uint amount)
    external
    onlyOwner
  {
    // TODO: see if it can be sold through proxy
    uint ethValue;
    withdrawableTokens[ethCurrency] = withdrawableTokens[ethCurrency].add(ethValue);
  }

  modifier onlyTokenApprovedOrOwner(uint256 tokenId) {
    require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved or owner");
    _;
  }

  fallback () payable external {
  }
}
