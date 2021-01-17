
## NexusMutual distributor

Sell NexusMutual cover to users without KYC.

Earn revenue on each sale through an optional fee and the NXM deposit return!

Issue NFTs for each NexusMutual cover that users own and can freely trade. 

### Addresses

#### mainnet

`Work in progress`

#### kovan

TODO: fill in

### Integration

To integrate with NexusMutual and start selling cover, deploy an instance
of the Distributor contract using the available DistributorFactory.

This contract becomes a NexusMutual member once the KYC for its address is approved.
(KYC fee is paid at contract creation as part of the call to the factory).

#### Deployment

```
# install all dependencies
npm i
# create a .env with your configuration
cp .env.sample .env
# fill in the blanks in .env

# run deploy
npm run deploy-kovan
```

#### KYC

##### Mainnet

`Work in progress`

##### Kovan

Get in touch with us on telegram to KYC your newly deployed contract.

### Contract functionality

#### User functions

Users are able to go through the buy->claim->redeem cycle.

#### buyCover

Allows users to buy NexusMutual cover.

For the cover pricing, the contract call currently requires a signed quote provided by
the NexusMutual quote engine, which is then abi-encoded as part of the `data` parameter.

```
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
    returns (uint)
```


#### submitClaim

Submit claim for the cover. Only one claim at a time can be active.

The `data` field is currently unused.

```
  function submitClaim(
    uint tokenId,
    bytes calldata data
  )
    external
    onlyTokenApprovedOrOwner(tokenId)
```

#### redeemClaim

Owner of the cover token reedems its claim payout. The Claim must have been approved and paid out,
to the distributor contract for this to succeed. 

Once redeemed the NFT token is burned.

```
  function redeemClaim(
    uint256 tokenId
  )
    public
    onlyTokenApprovedOrOwner(tokenId)
    nonReentrant
```

#### Owner admin

The contract accrues NXM over time as covers expire or are claimed. 
The owner controls the NXM tokens stored in the contract.
The owner can withdraw, sell, or provide sell allowance for NXM.

All distributor fees determined by the `feePercentage` are collected in the `treasury` address.

The owner can also pause the use of `buyCover`, change the `feePercentage` and set the `treasury` address
for storing its fees at any time.


#### approveNXM

```
  function approveNXM(address spender, uint256 amount) public onlyOwner 
```

#### withdrawNXM

```
function withdrawNXM(address recipient, uint256 amount) public onlyOwner 
```

#### sellNXM

Sell NXM stored in the distributor contract. The resulting ETH is sent to the `treasury` address.

```
function sellNXM(uint nxmIn, uint minEthOut) external onlyOwner 
```

#### switchMembership

Switch membership to another address of your choice. Currently requires that all covers tied
to the distributor are expired or claimed. 

```
function switchMembership(address newAddress) external onlyOwner 
```

#### setFeePercentage

Change the added fee on top of cover purchases at any time.

```
function setFeePercentage(uint _feePercentage) external onlyOwner 
```

#### setBuysAllowed

Pause/unpause cover purchases at any time.

```
function setBuysAllowed(bool _buysAllowed) external onlyOwner 
```

#### setTreasury

Change where the distributor fees are sent to at any time.

```
function setTreasury(address payable _treasury) external onlyOwner
```

### API endpoints


#### GET /quote

* document /GET Quote - explain response and how to use.
* document https://api.nexusmutual.io/coverables/contracts.json
* contact us for API key for production
* provide kovan endpoint for testing (kovan not probably)

#### GET /capacity

(alternatively do get quote without signature)





