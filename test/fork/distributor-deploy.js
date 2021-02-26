const fetch = require('node-fetch');
const { artifacts, web3, accounts, network } = require('hardhat');
const { ether, expectRevert } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');

const { submitGovernanceProposal } = require('./utils');
const { hex } = require('../utils').helpers;
const { ProposalCategory, Role } = require('../utils').constants;

const {
  toDecimal,
  calculateRelativeError,
  percentageBN,
  calculateEthForNXMRelativeError,
} = require('../utils').tokenPrice;

const { BN, toBN } = web3.utils;

const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
const MemberRoles = artifacts.require('MemberRoles');
const Pool = artifacts.require('Pool');
const NXMaster = artifacts.require('NXMaster');
const TemporaryNXMaster = artifacts.require('TemporaryNXMaster');
const NXMToken = artifacts.require('NXMToken');
const Governance = artifacts.require('Governance');
const PoolData = artifacts.require('PoolData');
const TokenFunctions = artifacts.require('TokenFunctions');
const Claims = artifacts.require('Claims');
const ClaimsReward = artifacts.require('ClaimsReward');
const Quotation = artifacts.require('Quotation');
const MCR = artifacts.require('MCR');
const Pool2 = artifacts.require('Pool2');
const LegacyPool1 = artifacts.require('LegacyPool1');
const LegacyMCR = artifacts.require('LegacyMCR');
const PriceFeedOracle = artifacts.require('PriceFeedOracle');
const ERC20 = artifacts.require('ERC20');
const SwapAgent = artifacts.require('SwapAgent');
const TwapOracle = artifacts.require('TwapOracle');
const DistributorFactory = artifacts.require('DistributorFactory');

const Address = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  SAI: '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
  WNXM: '0x0d438F3b5175Bebc262bF23753C1E53d03432bDE',
  DAIFEED: '0x773616E4d11A78F511299002da57A0a94577F1f4',
  UNIFACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  NXMHOLDER: '0xd7cba5b9a0240770cfd9671961dae064136fa240',
};

const owner = '0xeadaceccc5b32e0f2151a94ae5c3cfb11e349754';

let isHardhat;
const hardhatRequest = async (...params) => {

  if (isHardhat === undefined) {
    const nodeInfo = await web3.eth.getNodeInfo();
    isHardhat = !!nodeInfo.match(/Hardhat/);
  }

  if (isHardhat) {
    return network.provider.request(...params);
  }
};

const getAddressByCodeFactory = abis => code => abis.find(abi => abi.code === code).address;
const fund = async to => web3.eth.sendTransaction({ from: accounts[0], to, value: ether('1000000') });
const unlock = async member => hardhatRequest({ method: 'hardhat_impersonateAccount', params: [member] });

describe('creates distributor and approves KYC', function () {

  this.timeout(0);

  it('initializes contracts', async function () {

    const { mainnet: { abis } } = await fetch('https://api.nexusmutual.io/version-data/data.json').then(r => r.json());
    const getAddressByCode = getAddressByCodeFactory(abis);

    const token = await NXMToken.at(getAddressByCode('NXMTOKEN'));
    const memberRoles = await MemberRoles.at(getAddressByCode('MR'));
    const master = await NXMaster.at(getAddressByCode(('NXMASTER')));
    this.master = master;
    this.memberRoles = memberRoles;
    this.token = token;
  });

  it('funds accounts', async function () {

    for (const account of [owner]) {
      await fund(account);
      await unlock(account);
    }
  });

  it('deploys distributor', async function () {

    const params = {
      feePercentage: 10,
      tokenName: 'magictoken',
      tokenSymbol: 'MT',
      factoryAddress: '0x58505541E5341e3FB3d47645121602e4C77c08bF',
      treasury: '0xeadaceccc5b32e0f2151a94ae5c3cfb11e349754',
    };

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
      { value: ether('0.002') },
    );
    console.log(tx);
    const distributorAddress = tx.logs[0].args.contractAddress;
    console.log(`Successfully deployed at ${distributorAddress}`);
    this.distributorAddress = distributorAddress;
  });

  it('approves KYC for distributor', async function () {
    const { memberRoles, master, distributorAddress } = this;

    console.log('Approving kyc..');

    await memberRoles.kycVerdict(distributorAddress, true);
    console.log('Done');
  });
});
