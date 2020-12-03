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

  bytes4 public constant ethCurrency = "ETH";

  struct Token {
    uint claimId;
    uint price;
  }

  // cover Id => claim Id
  mapping (uint => Token) public tokens;
  uint public distributorFeePercentage;
  uint256 internal issuedTokensCount;

  mapping(address => uint) public withdrawableTokens;
  INXMaster master;

  constructor(address _masterAddress, uint _distributorFeePercentage) public {
    distributorFeePercentage = _distributorFeePercentage;
    master = INXMaster(_masterAddress);
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

    // mint token using the coverId as a tokenId (guaranteed unique)
    _mint(msg.sender, coverId);
    tokens[coverId].price = coverPrice;
  }

  function submitClaim(
    uint256 tokenId,
    bytes calldata data
  )
    external
    onlyTokenApprovedOrOwner(tokenId)
  {
    ICover cover = ICover(master.getLatestAddress("CO"));
    // coverId = tokenId
    uint claimId = cover.submitClaim(tokenId, data);
    tokens[tokenId].claimId = claimId;
    emit ClaimSubmitted(tokenId, claimId);
  }

  function redeemClaim(
    uint256 tokenId
  )
    public
    onlyTokenApprovedOrOwner(tokenId)
    nonReentrant
  {
    ICover cover = ICover(master.getLatestAddress("CO"));
    require(cover.payoutIsCompleted(tokens[tokenId].claimId), "Claim accepted but payout not completed");
    (/* status */, uint sumAssured, /* coverPeriod */, /* validUntil */, /* contractAddress */, address coverAsset, /* premiumNXM */) = cover.getCover(tokenId);

    _burn(tokenId);
    _sendAssuredSum(coverAsset, sumAssured);
    emit ClaimRedeemed(msg.sender, sumAssured, coverAsset);
  }

  function _sendAssuredSum(
    address coverAsset,
    uint sumAssured
    )
    internal
  {
    if (coverAsset == ETH) {
      (bool ok, /* data */) = msg.sender.call{value: sumAssured}("");
      require(ok, "Cover: Transfer to Pool failed");
    } else {
      IERC20 erc20 = IERC20(coverAsset);
      erc20.safeTransfer(msg.sender, sumAssured);
    }
  }

  function approveNXM(address _spender, uint256 _value)
  public
  onlyOwner
  {
    IERC20 nxmToken = IERC20(master.tokenAddress());
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

    IERC20 erc20 = IERC20(asset);
    require(erc20.transfer(_recipient, _amount), "Transfer failed");
  }

  modifier onlyTokenApprovedOrOwner(uint256 tokenId) {
    require(_isApprovedOrOwner(msg.sender, tokenId), "Not approved or owner");
    _;
  }

  fallback () payable external {
  }
}
