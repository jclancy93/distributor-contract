const fetch = require('node-fetch');
const { artifacts, web3, accounts, network } = require('hardhat');
const { ether, expectRevert, time } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');

const { BN, toBN } = web3.utils;

const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
const MemberRoles = artifacts.require('MemberRoles');

const NXMaster = artifacts.require('NXMaster');
const NXMToken = artifacts.require('NXMToken');
const Governance = artifacts.require('Governance');
const DistributorFactory = artifacts.require('DistributorFactory');
const Distributor = artifacts.require('Distributor');

const { submitGovernanceProposal } = require('./external').utils;
const { hex } = require('../utils').helpers;


const ProposalCategory = {
  addCategory: 3,
  editCategory: 4,
  upgradeProxy: 5,
  startEmergencyPause: 6,
  addEmergencyPause: 7, // extend or switch off emergency pause
  upgradeNonProxy: 29,
  newContract: 34,
  upgradeMaster: 37,
};


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
    const governance = await Governance.at(getAddressByCode('GV'));
    this.master = master;
    this.memberRoles = memberRoles;
    this.token = token;
    this.governance = governance;
  });

  it('funds accounts', async function () {

    console.log('Funding accounts');

    const { memberArray: boardMembers } = await this.memberRoles.members('1');
    const voters = boardMembers.slice(1, 4);

    for (const member of [...voters, Address.NXMHOLDER, owner]) {
      await fund(member);
      await unlock(member);
    }

    this.voters = voters;
  });

  it('deploys DistributorFactory', async function () {
    const { master }  = this;

    const factory = await DistributorFactory.new(master.address);


    this.factory = factory;
  });

  it('deploys distributor', async function () {

    const { factory, master } = this;

    const params = {
      feePercentage: 10,
      tokenName: 'magictoken',
      tokenSymbol: 'MT',
      treasury: '0xeadaceccc5b32e0f2151a94ae5c3cfb11e349754',
    };

    const { feePercentage, tokenName, tokenSymbol, treasury } = params;
    console.log(params);
    params.feePercentage *= 100;

    console.log(`Deploying with factory: ${factory.address}`);

    const tx = await factory.newDistributor(
      feePercentage,
      treasury,
      tokenName,
      tokenSymbol,
      { value: ether('0.002') },
    );
    const distributorAddress = tx.logs[0].args.contractAddress;
    console.log(`Successfully deployed at ${distributorAddress}`);

    const distributor = await Distributor.at(distributorAddress);

    const gwAddress =  await master.getLatestAddress(hex('GW'));
    const tokenAddress = await master.dAppToken();

    assert.equal(await distributor.gateway(), gwAddress);
    assert.equal(await distributor.nxmToken(), tokenAddress);
    assert.equal(await distributor.master(), master.address);
    this.distributorAddress = distributorAddress;
  });

  it('approves KYC for distributor', async function () {
    const { memberRoles, master, distributorAddress } = this;

    console.log('Approving kyc..');

    const { val: kycAuthorityAddress } = await master.getOwnerParameters(hex('KYCAUTH'));
    await fund(kycAuthorityAddress);
    await unlock(kycAuthorityAddress);

    await memberRoles.kycVerdict(distributorAddress, true, {
      from: kycAuthorityAddress
    });
    console.log('Done');
  });
});
