const { contract, accounts, defaultSender } = require('@openzeppelin/test-environment');
const { ether } = require('@openzeppelin/test-helpers');
const { hex } = require('./helpers');

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

const INITIAL_SUPPLY = ether('1500000');
const EXCHANGE_TOKEN = ether('10000');
const EXCHANGE_ETHER = ether('10');
const QE = '0x51042c4d8936a7764d18370a6a0762b860bb8e07';
const POOL_ETHER = ether('3500');

async function setup () {

  console.log('setup');
  const owner = defaultSender;

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

  const mcr = await MCR.new();

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
    mcr.address,
    gv.address,
    pc.address,
    mr.address,
  ];

  await master.addNewVersion(addresses);

  let pcAddress = await master.getLatestAddress(hex('PC'));
  pcInstance = await ProposalCategory.at(pcAddress);
  await pcInstance.proposalCategoryInitiate();

  // fund pools
  await p1.sendEther({ from: owner, value: POOL_ETHER });
  await p2.sendEther({ from: owner, value: POOL_ETHER });
  await dai.transfer(p2.address, ether('50'));

  await mcr.addMCRData(
    13000,
    ether('1000'),
    ether('70000'),
    [hex('ETH'), hex('DAI')],
    [100, 15517],
    20190103,
    { from: owner }
  );
  await p2.saveIADetails(
    [hex('ETH'), hex('DAI')],
    [100, 15517],
    20190103,
    true,
    { from: owner }
  ); //testing

  let mrInstance = await MemberRoles.at(
    await master.getLatestAddress(hex('MR'))
  );
  await mrInstance.payJoiningFee(owner, {
    from: owner,
    value: ether('0.002')
  });
  await mrInstance.kycVerdict(owner, true, {
    from: owner,
  });
  await mrInstance.addInitialABMembers([owner]);

  // third-party contracts
  this.dai = dai;

  // nexusmutual contracts
  this.master = master;
  this.mcr = mcr;
  this.tf = tf;
  this.tk = tk;
  this.pd = pd;
  this.cd = cd;
  this.qt = qt;
  this.cl = cl;
  this.p1 = p1;
  this.p2 = p2;
  this.td = td;
  this.mr = mrInstance;
  this.pc = pcInstance;
  this.tc =  await TokenController.at(await master.getLatestAddress(hex('TC')));
  this.gv = await Governance.at(await master.getLatestAddress(hex('GV')));
}

module.exports = setup;
