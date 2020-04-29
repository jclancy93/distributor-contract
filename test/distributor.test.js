const { contract, accounts } = require('@openzeppelin/test-environment');

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

  const distributorFeePercentage = 10;

  await Claims.new();
  await ClaimsData.new();
  await ClaimsReward.new();
  await Pool1.new();
  await Pool2.new(factory.address);
  await PoolData.new(founderAddress, dsv.address, dai.address);
  await MCR.new();
  const tokenController = await TokenController.new();
  const nxmToken = await NXMToken.new(founderAddress, INITIAL_SUPPLY);
  await TokenData.new(founderAddress);
  await TokenFunctions.new();
  await Quotation.new();
  await QuotationDataMock.new( QE, founderAddress);
  await Governance.new();
  await ProposalCategory.new();
  await MemberRoles.new();
  const nxMaster = await NXMaster.new(nxmToken.address);

  const distributor = await Distributor.new(nxMaster.address, distributorFeePercentage);

}

describe('Distributor', function () {
  this.timeout(10000);
  beforeEach(setup);

  it('does nothing', async function () {
  });
});
