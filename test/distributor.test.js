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


const INITIAL_SUPPLY = ether('1500000');
const EXCHANGE_TOKEN = ether('10000');
const EXCHANGE_ETHER = ether('10');
const QE = '0x51042c4d8936a7764d18370a6a0762b860bb8e07';


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
  const owner = accounts[0];

  // deploy external contracts
  const dai = await DAI.new();
  const mkr = await MKR.new();
  const dsv = await DSValue.new(owner);
  const factory = await FactoryMock.new();
  const exchange = await ExchangeMock.new(dai.address, factory.address);
  const exchangeMKR = await ExchangeMKRMock.new(mkr.address, factory.address);

  // initialize external contracts
  await factory.setFactory(dai.address, exchange.address);
  await factory.setFactory(mkr.address, exchangeMKR.address);
  await dai.transfer(exchange.address, EXCHANGE_TOKEN);
  await mkr.transfer(exchangeMKR.address, EXCHANGE_TOKEN);
  await exchange.recieveEther({ value: EXCHANGE_ETHER });
  await exchangeMKR.recieveEther({ value: EXCHANGE_ETHER });

  // nexusmutual contracts
  const cl = await Claims.new();
  const cd = await ClaimsData.new();
  const cr = await ClaimsReward.new();

  const p1 = await Pool1.new();
  const p2 = await Pool2.new(factory.address);
  const pd = await PoolData.new(owner, dsv.address, dai.address);

  const mc = await MCR.new();

  const tk = await NXMToken.new(owner, INITIAL_SUPPLY);
  const tc = await TokenController.new();
  const td = await TokenData.new(owner);
  const tf = await TokenFunctions.new();

  const qt = await Quotation.new();
  const qd = await QuotationDataMock.new(QE, owner);

  const gv = await Governance.new();
  const pc = await ProposalCategory.new();
  const mr = await MemberRoles.new();

  const master = await NXMaster.new(tk.address);

  const addresses = [
    qd.address,
    td.address,
    cd.address,
    pd.address,
    qt.address,
    tf.address,
    tc.address,
    cl.address,
    cr.address,
    p1.address,
    p2.address,
    mc.address,
    gv.address,
    pc.address,
    mr.address,
  ];

  await master.addNewVersion(addresses);
  await pc.proposalCategoryInitiate();

  // fund pools
  await p1.sendEther({ from: owner, value: ether('3500') });
  await p2.sendEther({ from: owner, value: ether('3500') });
  await dai.transfer(p2.address, ether('50'));

  await mc.addMCRData(
    13000,
    ether('100'),
    ether('7000'),
    [hex('ETH'), hex('DAI')],
    [100, 15517],
    20190103,
  );

  await p2.saveIADetails(
    [hex('ETH'), hex('DAI')],
    [100, 15517],
    20190103,
    true,
  );

  await mr.payJoiningFee(owner, { from: owner, value: ether('0.02') });
  await mr.kycVerdict(owner, true);
  await mr.addInitialABMembers([owner]);

  return { master };

  // setup only for tests

  await mr.addMembersBeforeLaunch([], []);
  (await mr.launched()).should.be.equal(true);
  await mcr.addMCRData(
    await getValue(toWei(2), pd, mcr),
    toWei(100),
    toWei(2),
    ['0x455448', '0x444149'],
    [100, 65407],
    20181011
  );
  (await pd.capReached()).toString().should.be.equal((1).toString());
  // await mr.payJoiningFee(owner, { from: owner, value: fee });
  // await mr.kycVerdict(owner, true);
  await mr.payJoiningFee(member1, {from: member1, value: fee});
  await mr.kycVerdict(member1, true);
  await mr.payJoiningFee(member2, {from: member2, value: fee});
  await mr.kycVerdict(member2, true);
  await mr.payJoiningFee(member3, {from: member3, value: fee});
  await mr.kycVerdict(member3, true);
  await mr.payJoiningFee(staker1, {from: staker1, value: fee});
  await mr.kycVerdict(staker1, true);
  await mr.payJoiningFee(staker2, {from: staker2, value: fee});
  await mr.kycVerdict(staker2, true);
  await mr.payJoiningFee(coverHolder, {from: coverHolder, value: fee});
  await mr.kycVerdict(coverHolder, true);
  await mr.payJoiningFee(distributor.address, {
    from: coverHolder,
    value: fee
  });
  await mr.kycVerdict(distributor.address, true);
  await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member1});
  await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member2});
  await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member3});
  await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker1});
  await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker2});
  await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: coverHolder});
  await distributor.nxmTokenApprove(tc.address, UNLIMITED_ALLOWANCE, {
    from: coverHolder
  });

  await tk.transfer(member1, ether(250));
  await tk.transfer(member2, ether(250));
  await tk.transfer(member3, ether(250));
  await tk.transfer(coverHolder, ether(250));
  await tk.transfer(distributor.address, ether(250));
  await tk.transfer(staker1, ether(250));
  await tk.transfer(staker2, ether(250));
  await tf.addStake(smartConAdd, stakeTokens, {from: staker1});
  await tf.addStake(smartConAdd, stakeTokens, {from: staker2});
  maxVotingTime = await cd.maxVotingTime();
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
