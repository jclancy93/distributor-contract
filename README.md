
## NexusMutual distributor

Sell NexusMutual cover to users without KYC.
Earn revenue on each sale through an optional fee and the NXM deposit return!

### Addresses

#### mainnet

`Work in progress`

#### kovan

TODO: fill in

### Integration

To integrate with NexusMutual and start selling cover you deploy an instance
of the Distributor contract using the available DistributorFactory.

This contract becomes a NexusMutual member once the KYC for its address is approved.
(KYC fee is paid at contract creation).

#### Deployment

```
# install all depedencies
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

```
  function submitClaim(
    uint tokenId,
    bytes calldata data
  )
    external
    onlyTokenApprovedOrOwner(tokenId)
```

#### redeemClaim

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

#### withdrawNXM

```
function withdrawNXM(address recipient, uint256 amount) public onlyOwner 
```

#### sellNXM

```
function sellNXM(uint nxmIn, uint minEthOut) external onlyOwner 
```

#### switchMembership
```
function switchMembership(address newAddress) external onlyOwner 
```

#### setFeePercentage

```
function setFeePercentage(uint _feePercentage) external onlyOwner 
```

#### setBuysAllowed

```
function setBuysAllowed(bool _buysAllowed) external onlyOwner 
```

#### setTreasury

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





