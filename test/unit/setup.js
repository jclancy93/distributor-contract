const { accounts, artifacts } = require('hardhat');
const { hex, ZERO_ADDRESS, ETH, DEFAULT_FEE_PERCENTAGE } = require('../utils').helpers;

const ERC20Mock = artifacts.require('ERC20Mock');
const ERC20DetailedMock = artifacts.require('ERC20DetailedMock');
const CoverMock = artifacts.require('CoverMock');
const Distributor = artifacts.require('Distributor');

const [, treasury] = accounts;

async function setup () {

  const nxmToken = await ERC20Mock.new();
  const dai = await ERC20DetailedMock.new();
  const cover = await CoverMock.new();
  const unused = '0x0000000000000000000000000000000000000023';
  const distributor = await Distributor.new(
    cover.address,
    nxmToken.address,
    ZERO_ADDRESS,
    DEFAULT_FEE_PERCENTAGE,
    treasury,
    'UnitTestToken',
    'UTT',
  );
  this.contracts = {
    nxmToken,
    cover,
    distributor,
    dai,
  };
}

module.exports = {
  setup,
};
