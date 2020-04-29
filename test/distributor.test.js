const { contract, accounts } = require('@openzeppelin/test-environment');

const Distributor = contract.fromArtifact('Distributor');
const NXMToken = contract.fromArtifact('NXMToken');
const NXMaster = contract.fromArtifact('NXMaster');

const INITIAL_SUPPLY = '1500000000000000000000000';

async function setup () {

  this.founderAddress = accounts[0];

  this.nxmToken = await NXMToken.new(this.founderAddress, INITIAL_SUPPLY);
  this.nxMaster = await NXMaster.new(this.nxmToken.address);
  this.distributorFeePercentage = 10;
  this.distributor = await Distributor.new(this.nxMaster.address, this.distributorFeePercentage);

}

describe('Distributor', function () {

  beforeEach(setup);

  it('does nothing', async function () {

  });
});
