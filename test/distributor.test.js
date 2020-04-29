const { contract, accounts, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, ether, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');

const DAI = contract.fromArtifact('MockDAI');
const MKR = contract.fromArtifact('MockMKR');
const DSValue = contract.fromArtifact('NXMDSValueMock');
const FactoryMock = contract.fromArtifact('FactoryMock');
const ExchangeMock = contract.fromArtifact('ExchangeMock');
const ExchangeMKRMock = contract.fromArtifact('ExchangeMock');
const NXMToken = contract.fromArtifact('NXMToken');
const NXMaster = contract.fromArtifact('NXMaster');
const Claims = contract.fromArtifact('Claims');
const ClaimsData = contract.fromArtifact('ClaimsDataMock');
const ClaimsReward = contract.fromArtifact('ClaimsReward');
const MCR = contract.fromArtifact('MCR');
const TokenData = contract.fromArtifact('TokenDataMock');
const TokenFunctions = contract.fromArtifact('TokenFunctionMock');
const TokenController = contract.fromArtifact('TokenController');
const Pool1 = contract.fromArtifact('Pool1Mock');
const Pool2 = contract.fromArtifact('Pool2');
const PoolData = contract.fromArtifact('PoolDataMock');
const Quotation = contract.fromArtifact('Quotation');
const QuotationDataMock = contract.fromArtifact('QuotationDataMock');
const Governance = contract.fromArtifact('Governance');
const ProposalCategory = contract.fromArtifact('ProposalCategory');
const MemberRoles = contract.fromArtifact('MemberRoles');
const Distributor = contract.fromArtifact('Distributor');


const INITIAL_SUPPLY = '1500000000000000000000000';

const EXCHANGE_TOKEN = '10000000000000000000000';
const EXCHANGE_ETHER = 10 ** 19;
const QE = '0x51042c4d8936a7764d18370a6a0762b860bb8e07';



// const {ether, toHex, toWei} = require('./utils/ethTools');
// const {increaseTimeTo, duration} = require('./utils/increaseTime');
// const {latestTime} = require('./utils/latestTime');
// const gvProp = require('./utils/gvProposal.js').gvProposal;
// const encode = require('./utils/encoder.js').encode;
// const getQuoteValues = require('./utils/getQuote.js').getQuoteValues;
// const getValue = require('./utils/getMCRPerThreshold.js').getValue;

const CA_ETH = '0x45544800';
const CLA = '0x434c41';
const fee = ether('0.002');
const PID = 0;
const smartConAdd = '0xd0a6e6c54dbc68db5db3a091b171a77407ff7ccf';
const coverPeriod = 61;
const coverDetails = [10, '3362445813369838', '744892736679184', '7972408607'];
const v = 28;
const r = '0x66049184fb1cf394862cca6c3b2a0c462401a671d0f2b20597d121e56768f90a';
const s = '0x4c28c8f8ff0548dd3a41d7c75621940eb4adbac13696a2796e98a59691bf53ff';

const coverDetailsDai = [5, '16812229066849188', '5694231991898', '7972408607'];
const vrs_dai = [
  27,
  '0xdcaa177410672d90890f1c0a42a965b3af9026c04caedbce9731cb43827e8556',
  '0x2b9f34e81cbb79f9af4b8908a7ef8fdb5875dedf5a69f84cd6a80d2a4cc8efff'
];

const distributorFeePercentage = 10;
const percentageDenominator = 100;
const coverPriceMultiplier = percentageDenominator + distributorFeePercentage;
const claimSubmitDepositPercentage = 5;

const coverBasePrice = new web3.utils.BN(coverDetails[1]);
const buyCoverValue = coverBasePrice
  .mul(new web3.utils.BN(coverPriceMultiplier))
  .div(new web3.utils.BN(percentageDenominator));
const buyCoverFee = buyCoverValue.sub(coverBasePrice);
const submitClaimDeposit = coverBasePrice
  .mul(new web3.utils.BN(claimSubmitDepositPercentage))
  .div(new web3.utils.BN(percentageDenominator));

const coverBaseDaiPrice = new web3.utils.BN(coverDetailsDai[1]);
const buyCoverDaiValue = coverBaseDaiPrice
  .mul(new web3.utils.BN(coverPriceMultiplier))
  .div(new web3.utils.BN(percentageDenominator));
const buyCoverDaiFee = buyCoverDaiValue.sub(coverBaseDaiPrice);
const submitClaimDaiDeposit = coverBaseDaiPrice
  .mul(new web3.utils.BN(claimSubmitDepositPercentage))
  .div(new web3.utils.BN(percentageDenominator));


async function setup () {

  const founderAddress = accounts[0];

  const dai = await DAI.new();
  const mkr = await MKR.new();
  const dsv = await DSValue.new(founderAddress);
  const factory = await FactoryMock.new();
  const exchange = await ExchangeMock.new(
    dai.address,
    factory.address
  );
  const exchangeMKR = await ExchangeMKRMock.new(
    mkr.address,
    factory.address
  );

  await factory.setFactory(dai.address, exchange.address);
  await factory.setFactory(mkr.address, exchangeMKR.address);
  await dai.transfer(exchange.address, EXCHANGE_TOKEN);
  await mkr.transfer(exchangeMKR.address, EXCHANGE_TOKEN);
  await exchange.recieveEther({ value: EXCHANGE_ETHER });
  await exchangeMKR.recieveEther({ value: EXCHANGE_ETHER });

  const claims = await Claims.new();
  const claimsData = await ClaimsData.new();
  const claimsReward = await ClaimsReward.new();
  const pool1 = await Pool1.new();
  const pool2 = await Pool2.new(factory.address);
  const poolData = await PoolData.new(founderAddress, dsv.address, dai.address);
  const mcr = await MCR.new();
  const tokenController = await TokenController.new();
  const nxmToken = await NXMToken.new(founderAddress, INITIAL_SUPPLY);
  const tokenData = await TokenData.new(founderAddress);
  const tokenFunctions = await TokenFunctions.new();
  const quotation = await Quotation.new();
  const quotationData = await QuotationDataMock.new( QE, founderAddress);
  const governance = await Governance.new();
  const proposalCategory = await ProposalCategory.new();
  const memberRoles = await MemberRoles.new();
  const nxMaster = await NXMaster.new(nxmToken.address);

  const distributor = await Distributor.new(nxMaster.address, distributorFeePercentage);


  let addr = [
    quotationData.address,
    tokenData.address,
    claimsData.address,
    poolData.address,
    quotationData.address,
    tokenFunctions.address,
    tokenController.address,
    claims.address,
    claimsReward.address,
    pool1.address,
    pool2.address,
    mcr.address,
    governance.address,
    proposalCategory.address,
    memberRoles.address
  ];
  await nxMaster.addNewVersion(addr);
  let pcAddress = await nxMaster.getLatestAddress('0x5043');
  await proposalCategory.proposalCategoryInitiate();
  // await qd.changeCurrencyAssetAddress('0x444149', dai.address);
  // await qd.changeInvestmentAssetAddress('0x444149', dai.address);
  await pool1.sendEther({ from: Owner, value: POOL_ETHER });
  await pool2.sendEther({ from: Owner, value: POOL_ETHER }); //
  await mcr.addMCRData(
    13000,
    '100000000000000000000',
    '7000000000000000000000',
    ['0x455448', '0x444149'],
    [100, 15517],
    20190103
  );
  await pool2.saveIADetails(
    ['0x455448', '0x444149'],
    [100, 15517],
    20190103,
    true
  ); //testing
  await dai.transfer(pool2.address, POOL_ASSET);
  let mrInstance = await MemberRoles.at(
    await nxMaster.getLatestAddress('0x4d52')
  );
  await mrInstance.payJoiningFee(Owner, {
    from: Owner,
    value: '2000000000000000'
  });
  await mrInstance.kycVerdict(Owner, true);
  await mrInstance.addInitialABMembers([Owner]);

  // setup only for tests

  await memberRoles.addMembersBeforeLaunch([], []);
  (await memberRoles.launched()).should.be.equal(true);
  await mcr.addMCRData(
    await getValue(toWei(2), pd, mcr),
    toWei(100),
    toWei(2),
    ['0x455448', '0x444149'],
    [100, 65407],
    20181011
  );
  (await poolData.capReached()).toString().should.be.equal((1).toString());

  await memberRoles.payJoiningFee(member1, {from: member1, value: fee});
  await memberRoles.kycVerdict(member1, true);
  await memberRoles.payJoiningFee(member2, {from: member2, value: fee});
  await memberRoles.kycVerdict(member2, true);
  await memberRoles.payJoiningFee(member3, {from: member3, value: fee});
  await memberRoles.kycVerdict(member3, true);
  await memberRoles.payJoiningFee(staker1, {from: staker1, value: fee});
  await memberRoles.kycVerdict(staker1, true);
  await memberRoles.payJoiningFee(staker2, {from: staker2, value: fee});
  await memberRoles.kycVerdict(staker2, true);
  await memberRoles.payJoiningFee(coverHolder, {from: coverHolder, value: fee});
  await memberRoles.kycVerdict(coverHolder, true);
  await memberRoles.payJoiningFee(distributor.address, {
    from: coverHolder,
    value: fee
  });
  await memberRoles.kycVerdict(distributor.address, true);
  await nxmToken.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member1});
  await nxmToken.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member2});
  await nxmToken.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member3});
  await nxmToken.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker1});
  await nxmToken.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker2});
  await nxmToken.approve(tc.address, UNLIMITED_ALLOWANCE, {from: coverHolder});
  await distributor.nxmTokenApprove(tc.address, UNLIMITED_ALLOWANCE, {
    from: coverHolder
  });

  await nxmToken.transfer(member1, ether(250));
  await nxmToken.transfer(member2, ether(250));
  await nxmToken.transfer(member3, ether(250));
  await nxmToken.transfer(coverHolder, ether(250));
  await tk.transfer(distributor.address, ether(250));
  await nxmToken.transfer(staker1, ether(250));
  await nxmToken.transfer(staker2, ether(250));
  await tokenFunctions.addStake(smartConAdd, stakeTokens, {from: staker1});
  await tokenFunctions.addStake(smartConAdd, stakeTokens, {from: staker2});
  maxVotingTime = await claimsData.maxVotingTime();
}

async function setupVoting () {

}

describe('Distributor', function () {
  this.timeout(10000);
  beforeEach(setup);
  const [
    owner,
    member1,
    member2,
    member3,
    staker1,
    staker2,
    coverHolder,
    nftCoverHolder1,
    distributorFeeReceiver
  ] = accounts;


  describe('ETH covers', function () {
    it('does nothing', async function () {
    });
  });
});
