/* Copyright (C) 2017 NexusMutual.io

  This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

  This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
    along with this program.  If not, see http://www.gnu.org/licenses/ */

pragma solidity 0.7.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/INXMaster.sol";
import "./interfaces/ICover.sol";


contract Distributor is
  ERC721("NXMDistributorNFT", "NXMDNFT"),
  Ownable,
  ReentrancyGuard {
  using SafeMath for uint;
  using SafeERC20 for IERC20;

  address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  struct Token {
    uint expirationTimestamp;
    address coverAsset;
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
    address coverAsset
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
  mapping(address => uint) public withdrawableTokens;
  INXMaster master;

  constructor(address _masterAddress, uint _distributorFeePercentage) public {
    distributorFeePercentage = _distributorFeePercentage;
    master = INXMaster(_masterAddress);
  }

  // Arguments to be passed as coverDetails, from the quote api:
  //    coverDetails[0] = coverAmount;
  //    coverDetails[1] = coverPrice;
  //    coverDetails[2] = coverPriceNXM;
  //    coverDetails[3] = expireTime;
  //    coverDetails[4] = generationTime;
  function buyCover (
    address contractAddress,
    address coverAsset,
    uint coverAmount,
    uint16 coverPeriod,
    uint coverPrice,
    uint coverType,
    bytes calldata data
  )
     external
     payable
  {

    address coverContractAddress = master.getLatestAddress("CO");
    ICover cover = ICover(coverContractAddress);
    uint requiredValue = distributorFeePercentage.mul(coverPrice).div(100).add(coverPrice);
    if (coverAsset == ETH) {
      require(msg.value == requiredValue, "Incorrect value sent");
      // solhint-disable-next-line avoid-low-level-calls
      (bool ok, /* data */) = address(cover).call{value: coverPrice}("");
      require(ok, "Cover: Transfer to Pool failed");
    } else {
      IERC20 token = IERC20(coverAsset);
      token.safeTransferFrom(msg.sender, address(this), requiredValue);
      token.safeApprove(coverContractAddress, coverPrice);
    }

    uint coverId = cover.buyCover(
      contractAddress,
      coverAsset,
      coverAmount,
      coverPeriod,
      coverType,
      data
    );

    withdrawableTokens[coverAsset] = withdrawableTokens[coverAsset].add(requiredValue.sub(coverPrice));

    // mint token
    uint256 nextTokenId = issuedTokensCount++;

    // TODO: fix
    uint expirationTimestamp = 0;
    tokens[nextTokenId] = Token(expirationTimestamp,
      coverAsset,
      0,
      1,
      2,
      3,
      4,
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
    _sendAssuredSum("ETH", sumAssured);
    emit ClaimRedeemed(msg.sender, sumAssured, tokens[tokenId].coverAsset);
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
    ICover cover = ICover(master.getLatestAddress("CO"));

    require(withdrawableTokens[ETH] >= _amount, "Not enough ETH");
    withdrawableTokens[ETH] = withdrawableTokens[ETH].sub(_amount);
    _recipient.transfer(_amount);
  }

  function withdrawTokens(address payable _recipient, uint256 _amount, address asset)
    external
    onlyOwner
    nonReentrant
  {
    require(withdrawableTokens[asset] >= _amount, "Not enough tokens");
    withdrawableTokens[asset] = withdrawableTokens[asset].sub(_amount);

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
  }

  modifier onlyTokenApprovedOrOwner(uint256 tokenId) {
    require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved or owner");
    _;
  }

  fallback () payable external {
  }
}
