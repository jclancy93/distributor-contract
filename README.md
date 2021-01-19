
## NexusMutual distributor

Sell NexusMutual cover to users without KYC.

Earn revenue on each sale through an optional fee and the NXM deposit return!

Issue NFTs for each NexusMutual cover that users own and can freely trade. 

### Addresses

#### mainnet

`Work in progress`

#### kovan

DistributorFactory: `0x58505541E5341e3FB3d47645121602e4C77c08bF`
NXMaster: `0x3152bE12988ECa5C9FB4102CF110771bA32A29dE`

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

See the following example node.js code for buying cover. Equivalent code will have to be implemented
on the UI side. Example code uses the hardhat `run` command to run and TruffleContract however it 
should be easily translatable to frontend code that does the equivalent with the library of choice
(web3, ethers etc.). 

Example:

https://github.com/NexusMutual/distributor-contract/blob/distributor-contract-v1/examples/example-buy-cover.js


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

To enable users to `buyCover` a signed price quote is currently necessary.

#### GET v1/quote

Get a signed price quote to use as part 


Example mainnet call:

```
curl -X GET -H "Origin: https://yourcustomorigin.com" 'https://api.nexusmutual.io/v1/quote?coverAmount=1&currency=ETH&period=111&contractAddress=0xC57D000000000000000000000000000000000002'
```

Example kovan call:

```
curl -X GET -H "Origin: https://yourcustomorigin.com" 'https://api.staging.nexusmutual.io/v1/quote?coverAmount=1&currency=ETH&period=111&contractAddress=0xC57D000000000000000000000000000000000002'
```


Example response:
```
{
   "currency":"ETH",
   "period":"111",
   "amount":"1",
   "price":"7901437371663244",
   "priceInNXM":"206328266227258591",
   "expiresAt":1610868026,
   "generatedAt":1610867125800,
   "contract":"0xc57d000000000000000000000000000000000002",
   "v":27,
   "r":"0x19b567db10ddd7c64cd0bb4c012b8a77266515b54e488730b1a1aca79ea783d8",
   "s":"0x0a052b90cf91623f724d64dc441012cd703b8c0b49ac9b67795ed5f5f61ebbd6"
}
```

**Warning**: the `"amount"` field is in units *not in wei*. 1 means 1 ETH.

Contact our team to get your `origin` whitelisted.

#### GET v1/contracts/<contract-address>/capacity

Returns the available capacity for a particular contract in both ETH and DAI.
Based on available capacity you can decide whether a cover can be offered or not.
(sum assured of that cover < available capacity).

Example Kovan call:
```
curl  -X GET  -H "Origin: http://yourcustomorigin.com" 'https://api.staging.nexusmutual.io/v1/contracts/0xC57D000000000000000000000000000000000002/capacity'
```

Example Mainnet call:
```
curl  -X GET  -H "Origin: http://yourcustomorigin.com" 'https://api.nexusmutual.io/v1/contracts/0xC57D000000000000000000000000000000000002/capacity'
``` 

Example response:

```
{
   "capacityETH":"3652580281259279314200",
   "capacityDAI":"4330350165767307632900000",
   "netStakedNXM":"51152035000000000000000",
   "capacityLimit":"STAKED_CAPACITY"
}
```

#### GET coverables/contracts.json

Provides you with a list of contracts that can be covered to display within your app.

Example call:

```
 curl https://api.nexusmutual.io/coverables/contracts.json
```

Example response:

```
{
  "0xF5DCe57282A584D2746FaF1593d3121Fcac444dC":{
    "name":"Compound Sai",
    "type": "contract",
    "dateAdded":"2020-01-01",
    "deprecated":true
  },
  "0x8B3d70d628Ebd30D4A2ea82DB95bA2e906c71633":{
    "name":"bZx",
    "type": "contract",
    "dateAdded":"2020-01-01",
    "logo":"https://api.nexusmutual.io/coverables/images/bzx.png",
    "github":"https://github.com/bZxNetwork",
    "messari":""
  },
}
```

Important: If an entry has `"deprecated": true` skip it. no more covers can be bought on it. 



