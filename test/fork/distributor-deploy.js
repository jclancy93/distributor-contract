const fetch = require('node-fetch');
const { artifacts, web3, accounts, network } = require('hardhat');
const { ether, expectRevert } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');

const { BN, toBN } = web3.utils;

const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
const MemberRoles = artifacts.require('MemberRoles');

const NXMaster = artifacts.require('NXMaster');
const NXMToken = artifacts.require('NXMToken');
const Governance = artifacts.require('Governance');
const PoolData = artifacts.require('PoolData');
const TokenFunctions = artifacts.require('TokenFunctions');
const Claims = artifacts.require('Claims');
const ClaimsReward = artifacts.require('ClaimsReward');
const Quotation = artifacts.require('Quotation');
const ERC20 = artifacts.require('ERC20');
const DistributorFactory = artifacts.require('DistributorFactory');
const Cover = artifacts.require('Cover');


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
    const voters = boardMembers.slice(0, 3);

    for (const member of [...voters, Address.NXMHOLDER, owner]) {
      await fund(member);
      await unlock(member);
    }

    this.voters = voters;
  });

  it('upgrades contracts', async function () {
    const { master, governance, voters } = this;
    console.log('Deploying contracts');

    const newCL = await Claims.new();
    const newMR = await MemberRoles.new();
    const newQuotation = await Quotation.new();


    console.log('Upgrading CL QT');

    const upgradesActionDataNonProxy = web3.eth.abi.encodeParameters(
      ['bytes2[]', 'address[]'],
      [
        ['CL', 'QT'].map(hex),
        [newCL, newQuotation].map(c => c.address),
      ],
    );

    await submitGovernanceProposal(
      ProposalCategory.upgradeNonProxy,
      upgradesActionDataNonProxy,
      voters,
      governance,
    );

    const storedCLAddress = await master.getLatestAddress(hex('CL'));
    const storedQTAddress = await master.getLatestAddress(hex('QT'));

    assert.equal(storedCLAddress, newCL.address);
    assert.equal(storedQTAddress, newQuotation.address);

    console.log('Non-proxy upgrade successful.');

    console.log('Upgrading MR');

    const upgradesActionDataProxy = web3.eth.abi.encodeParameters(
      ['bytes2[]', 'address[]'],
      [
        ['MR'].map(hex),
        [newMR].map(c => c.address),
      ],
    );

    await submitGovernanceProposal(
      ProposalCategory.upgradeProxy,
      upgradesActionDataProxy,
      voters,
      governance,
    );

    const mrProxy = await OwnedUpgradeabilityProxy.at(await master.getLatestAddress(hex('MR')));
    const mrImplementation = await mrProxy.implementation();

    assert.equal(mr.address, mrImplementation.address);

    console.log('Proxy Upgrade successful.');
  });

  it('adds new Cover.sol contract', async function () {
    const { master, voters, governance } = this;
    console.log('Adding new cover contract..');
    const coverImplementation = await Cover.new();


    // Creating proposal for adding new internal contract
    const addNewInternalContractActionData = web3.eth.abi.encodeParameters(
      ['bytes2', 'address', 'uint'],
      [hex('CO'), coverImplementation.address, 2],
    );

    await submitGovernanceProposal(
      ProposalCategory.newContract,
      addNewInternalContractActionData,
      voters,
      governance
    );

    const coverProxy = await OwnedUpgradeabilityProxy.at(await master.getLatestAddress(hex('CO')));
    const storedImplementation = await coverProxy.implementation();

    assert.equal(storedImplementation, coverImplementation.address);

    const cover = await Cover.at(await master.getLatestAddress(hex('CO')));

    const storedDAI = await cover.DAI();
    assert.equal(storedDAI, Address.DAI);


    this.cover = cover;
  });

  it('deploys DistributorFactory', async function () {
    const { master }  = this;

    const factory = await DistributorFactory.new(master.address);

    this.factory = factory;
  });

  it('deploys distributor', async function () {

    const { factory } = this;

    const params = {
      feePercentage: 10,
      tokenName: 'magictoken',
      tokenSymbol: 'MT',
      factoryAddress: '0x58505541E5341e3FB3d47645121602e4C77c08bF',
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
    console.log(tx);
    const distributorAddress = tx.logs[0].args.contractAddress;
    console.log(`Successfully deployed at ${distributorAddress}`);
    this.distributorAddress = distributorAddress;
  });

  it('approves KYC for distributor', async function () {
    const { memberRoles, master, distributorAddress } = this;

    console.log('Approving kyc..');

    const kycAuthorityAddress = await master.getOwnerParameters(hex('KYCAUTH'));
    await fund(kycAuthorityAddress);
    await unlock(kycAuthorityAddress);

    await memberRoles.kycVerdict(distributorAddress, true, {
      from: kycAuthorityAddress
    });
    console.log('Done');
  });
});
