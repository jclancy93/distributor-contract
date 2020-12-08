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

pragma solidity ^0.7.4;

import "@openzeppelin/contracts-v3/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-v3/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-v3/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-v3/access/Ownable.sol";
import "@openzeppelin/contracts-v3/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-v3/math/SafeMath.sol";
import "./interfaces/ICover.sol";


contract Distributor is
  ERC721("NXMDistributorNFT", "NXMDNFT"),
  Ownable,
  ReentrancyGuard {
  using SafeMath for uint;
  using SafeERC20 for IERC20;

  address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  event ClaimRedeemed (
    uint indexed coverId,
    uint indexed claimId,
    address receiver,
    uint payout,
    address coverAsset
  );

  event ClaimSubmitted (
    uint indexed coverId,
    uint indexed claimId,
    address indexed submitter
  );

  event CoverBought (
    uint indexed coverId,
    address indexed buyer,
    address indexed contractAddress
  );

  struct Token {
    uint claimId;
    uint price;
  }

  mapping (uint => Token) public tokens;
  uint public feePercentage; // with 2 decimals. eg.: 10.00% stored as 1000
  uint256 internal issuedTokensCount;

  mapping(address => uint) public withdrawableTokens;
  ICover cover;
  IERC20 nxmToken;

  constructor(address coverAddress, address nxmTokenAddress, uint _feePercentage) public {
    feePercentage = _feePercentage;
    cover = ICover(coverAddress);
    nxmToken = IERC20(nxmTokenAddress);
  }

  function buyCover (
    address contractAddress,
    address coverAsset,
    uint coverAmount,
    uint16 coverPeriod,
    uint coverPrice,
    uint8 coverType,
    bytes calldata data
  )
     external
     payable
  {

    uint coverPriceWithFee = feePercentage.mul(coverPrice).div(10000).add(coverPrice);
    if (coverAsset == ETH) {
      require(msg.value == coverPriceWithFee, "Distributor: Incorrect ETH value sent");
      // solhint-disable-next-line avoid-low-level-calls
      (bool ok, /* data */) = address(cover).call{value: coverPrice}("");
      require(ok, "Distributor: Token Transfer to NexusMutual failed");
    } else {
      IERC20 token = IERC20(coverAsset);
      token.safeTransferFrom(msg.sender, address(this), coverPriceWithFee);
      token.safeApprove(address(cover), coverPrice);
    }

    uint coverId = cover.buyCover(
      contractAddress,
      coverAsset,
      coverAmount,
      coverPeriod,
      coverType,
      data
    );

    withdrawableTokens[coverAsset] = withdrawableTokens[coverAsset].add(coverPriceWithFee.sub(coverPrice));

    // mint token using the coverId as a tokenId (guaranteed unique)
    _mint(msg.sender, coverId);
    tokens[coverId].price = coverPrice;

    emit CoverBought(coverId, msg.sender, contractAddress);
  }

  function submitClaim(
    uint256 tokenId,
    bytes calldata data
  )
    external
    onlyTokenApprovedOrOwner(tokenId)
  {
    // coverId = tokenId
    uint claimId = cover.submitClaim(tokenId, data);
    tokens[tokenId].claimId = claimId;
    emit ClaimSubmitted(tokenId, claimId, msg.sender);
  }

  function redeemClaim(
    uint256 tokenId
  )
    public
    onlyTokenApprovedOrOwner(tokenId)
    nonReentrant
  {
    require(cover.payoutIsCompleted(tokens[tokenId].claimId), "Distributor: Claim accepted but payout not completed");
    (
      /* status */, /* sumAssured */, /* coverPeriod */, /* validUntil */, /* contractAddress */,
      address coverAsset, /* premiumNXM */, uint payout
    ) = cover.getCover(tokenId);

    _burn(tokenId);
    _sendAssuredSum(coverAsset, payout);
    emit ClaimRedeemed(tokenId, tokens[tokenId].claimId, msg.sender, payout, coverAsset);
  }

  function _sendAssuredSum(
    address coverAsset,
    uint sumAssured
    )
    internal
  {
    if (coverAsset == ETH) {
      (bool ok, /* data */) = msg.sender.call{value: sumAssured}("");
      require(ok, "Distributor: Transfer to Pool failed");
      return;
    }
    IERC20 erc20 = IERC20(coverAsset);
    erc20.safeTransfer(msg.sender, sumAssured);
  }

  function approveNXM(address _spender, uint256 _value)
  public
  onlyOwner
  {
    nxmToken.approve(_spender, _value);
  }

  function withdrawEther(address payable _recipient, uint256 _amount)
    external
    onlyOwner
    nonReentrant
  {
    require(withdrawableTokens[ETH] >= _amount, "Distributor: Not enough ETH");
    withdrawableTokens[ETH] = withdrawableTokens[ETH].sub(_amount);
    _recipient.transfer(_amount);
  }

  function withdrawTokens(address payable _recipient, uint256 _amount, address asset)
    external
    onlyOwner
    nonReentrant
  {
    require(withdrawableTokens[asset] >= _amount, "Distributor: Not enough tokens");
    withdrawableTokens[asset] = withdrawableTokens[asset].sub(_amount);

    IERC20 erc20 = IERC20(asset);
    require(erc20.transfer(_recipient, _amount), "Distributor: Transfer failed");
  }

  function setFeePercentage(uint _feePercentage) public onlyOwner {
    feePercentage = _feePercentage;
  }

  modifier onlyTokenApprovedOrOwner(uint256 tokenId) {
    require(_isApprovedOrOwner(msg.sender, tokenId), "Distributor: Not approved or owner");
    _;
  }

  fallback () payable external {
  }
}
