const { artifacts, web3 } = require('hardhat');
const { ether } = require('@openzeppelin/test-helpers');
const prompts = require('prompts');

const DistributorFactory = artifacts.require('DistributorFactory');
const NXMaster = artifacts.require('NXMaster');

async function run () {
  const params = await prompts([
    {
      type: 'text',
      name: 'factoryAddress',
      message: 'Input distributor factory address',
      validate: value => web3.utils.isAddress(value) ? true : `Not a valid contract address`
    },
    {
      type: 'text',
      name: 'tokenName',
      message: 'Input your token name (eg.: AwesomeDistributor)',
    },
    {
      type: 'text',
      name: 'tokenSymbol',
      message: 'Input your token symbol (eg.: AWD)',
    },
    {
      type: 'number',
      float: true,
      min: 0,
      round: 2,
      name: 'feePercentage',
      message: 'Input your fee percentage (eg. 7.25)',
    },
    {
      type: 'text',
      name: 'treasury',
      message: 'Input your treasury address (all your fee profits and sellNXM ETH returns will be sent here!)',
      validate: value => web3.utils.isAddress(value) ? true : `Not a valid Ethereum address`
    },
  ]);

  const { feePercentage, tokenName, tokenSymbol, factoryAddress, treasury } = params;
  console.log(params);
  params.feePercentage *= 100;

  console.log(`Deploying with factory: ${factoryAddress}`);

  const factory = await DistributorFactory.at(factoryAddress);
  const tx = await factory.newDistributor(
    feePercentage,
    treasury,
    tokenName,
    tokenSymbol,
    { value: ether('0.002') }
  );
  const distributorAddress = tx.logs[0].args.contractAddress;
  console.log(`Successfully deployed at ${distributorAddress}`);
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('An unexpected error encountered:', error);
    process.exit(1);
  });
