const { hex, ZERO_ADDRESS, ETH, DEFAULT_FEE_PERCENTAGE } = require('../utils').helpers;

const ERC20Mock = artifacts.require('ERC20Mock');
const CoverMock = artifacts.require('CoverMock');
const Distributor = artifacts.require('Distributor');

async function setup () {

  const nxmToken = await ERC20Mock.new();
  const cover = await CoverMock.new();
  const unused = '0x0000000000000000000000000000000000000023';
  const distributor = await Distributor.new(
    cover.address,
    nxmToken.address,
    ZERO_ADDRESS,
    DEFAULT_FEE_PERCENTAGE,
    'UnitTestToken',
    'UTT',
  );
  this.contracts = {
    nxmToken,
    cover,
    distributor,
  };
}

module.exports = {
  setup,
};
