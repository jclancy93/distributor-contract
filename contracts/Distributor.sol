/* Copyright (C) 2021 NexusMutual.io

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
import "hardhat/console.sol";
import "./interfaces/IPool.sol";

contract Distributor is
  ERC721,
  Ownable,
  ReentrancyGuard {
  using SafeMath for uint;
  using SafeERC20 for IERC20;

  address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  event ClaimPayoutRedeemed (
    uint indexed coverId,
    uint indexed claimId,
    address indexed receiver,
    uint amountPaid,
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
    address indexed contractAddress,
    uint feePercentage,
    uint coverPrice
  );

  mapping (uint => uint) public claimIds;
  uint public feePercentage; // with 2 decimals. eg.: 10.00% stored as 1000
  bool buysAllowed = true;

  mapping(address => uint) public withdrawableTokens;
  ICover cover;
  IERC20 nxmToken;
  IPool pool;

  constructor(
    address coverAddress,
    address nxmTokenAddress,
    address poolAddress,
    uint _feePercentage,
    string memory tokenName,
    string memory tokenSymbol
  )
  ERC721(tokenName, tokenSymbol)
  public
  {
    feePercentage = _feePercentage;
    cover = ICover(coverAddress);
    nxmToken = IERC20(nxmTokenAddress);
    pool = IPool(poolAddress);
  }

  function buyCover (
    address contractAddress,
    address coverAsset,
    uint sumAssured,
    uint16 coverPeriod,
    uint8 coverType,
    bytes calldata data
  )
     external
     payable
     nonReentrant
  {
    require(buysAllowed, "Distributor: buys not allowed");

    uint coverPrice = cover.getCoverPrice(contractAddress, coverAsset, sumAssured, coverPeriod, coverType, data);
    uint coverPriceWithFee = feePercentage.mul(coverPrice).div(10000).add(coverPrice);
    uint buyCoverValue = 0;
    if (coverAsset == ETH) {
      require(msg.value >= coverPriceWithFee, "Distributor: Insufficient ETH sent");
      uint remainder = msg.value - coverPriceWithFee;
      // solhint-disable-next-line avoid-low-level-calls
      (bool ok, /* data */) = address(msg.sender).call{value: remainder}("");
      require(ok, "Distributor: Returning ETH remainder to sender failed.");
      buyCoverValue = coverPrice;
    } else {
      IERC20 token = IERC20(coverAsset);
      token.safeTransferFrom(msg.sender, address(this), coverPriceWithFee);
      token.safeApprove(address(cover), coverPrice);
    }

    uint coverId = cover.buyCover{value: buyCoverValue }(
      contractAddress,
      coverAsset,
      sumAssured,
      coverPeriod,
      coverType,
      data
    );

    withdrawableTokens[coverAsset] = withdrawableTokens[coverAsset].add(coverPriceWithFee.sub(coverPrice));

    // mint token using the coverId as a tokenId (guaranteed unique)
    _mint(msg.sender, coverId);

    emit CoverBought(coverId, msg.sender, contractAddress, feePercentage, coverPrice);
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
    claimIds[tokenId] = claimId;
    emit ClaimSubmitted(tokenId, claimId, msg.sender);
  }

  function redeemClaim(
    uint256 tokenId
  )
    public
    onlyTokenApprovedOrOwner(tokenId)
    nonReentrant
  {
    uint claimId = claimIds[tokenId];
    require(cover.payoutIsCompleted(claimId), "Distributor: Claim accepted but payout not completed");
    (
      /* status */, /* sumAssured */, /* coverPeriod */, /* validUntil */, /* contractAddress */,
      address coverAsset, /* premiumNXM */, uint amountPaid
    ) = cover.getCover(tokenId);

    _burn(tokenId);
    if (coverAsset == ETH) {
      (bool ok, /* data */) = msg.sender.call{value: amountPaid}("");
      require(ok, "Distributor: Transfer to NFT owner failed");
    } else {
      IERC20 erc20 = IERC20(coverAsset);
      erc20.safeTransfer(msg.sender, amountPaid);
    }

    emit ClaimPayoutRedeemed(tokenId, claimId, msg.sender, amountPaid, coverAsset);
  }

  function executeCoverAction(uint tokenId, uint8 action, bytes calldata data)
    external
    payable
    onlyTokenApprovedOrOwner(tokenId)
    returns (bytes memory)
  {
    return cover.executeCoverAction{ value: msg.value }(tokenId, action, data);
  }

  function approveNXM(address _spender, uint256 _value)
  public
  onlyOwner
  {
    nxmToken.approve(_spender, _value);
  }

  function switchMembership(address newAddress) external onlyOwner {
    nxmToken.approve(address(cover), uint(-1));
    cover.switchMembership(newAddress);
  }

  function sellNXM(uint nxmIn, uint minEthOut) external onlyOwner {

    nxmToken.approve(address(pool), nxmIn);
    uint balanceBefore = address(this).balance;
    pool.sellNXM(nxmIn, minEthOut);
    uint balanceAfter = address(this).balance;
    withdrawableTokens[ETH] = withdrawableTokens[ETH].add(balanceAfter.sub(balanceBefore));
  }

  function deprecated_sellNXM(uint nxmIn) external onlyOwner {

    nxmToken.approve(address(pool), nxmIn);
    uint balanceBefore = address(this).balance;
    pool.sellNXMTokens(nxmIn);
    uint balanceAfter = address(this).balance;
    withdrawableTokens[ETH] = withdrawableTokens[ETH].add(balanceAfter.sub(balanceBefore));
  }

  function setBuysAllowed(bool _buysAllowed) external onlyOwner {
    buysAllowed = _buysAllowed;
  }

  function withdrawEther(address payable recipient, uint256 amount)
    external
    onlyOwner
    nonReentrant
  {
    require(withdrawableTokens[ETH] >= amount, "Distributor: Not enough ETH");
    withdrawableTokens[ETH] = withdrawableTokens[ETH].sub(amount);
    recipient.transfer(amount);
  }

  function withdrawTokens(address payable recipient, uint256 amount, address asset)
    external
    onlyOwner
    nonReentrant
  {
    require(withdrawableTokens[asset] >= amount, "Distributor: Not enough tokens");
    withdrawableTokens[asset] = withdrawableTokens[asset].sub(amount);

    IERC20 erc20 = IERC20(asset);
    require(erc20.transfer(recipient, amount), "Distributor: Transfer failed");
  }

  function setFeePercentage(uint _feePercentage) external onlyOwner {
    feePercentage = _feePercentage;
  }

  modifier onlyTokenApprovedOrOwner(uint256 tokenId) {
    require(_isApprovedOrOwner(msg.sender, tokenId), "Distributor: Not approved or owner");
    _;
  }

  fallback () payable external {
  }
}
