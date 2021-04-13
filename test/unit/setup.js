const { accounts, artifacts } = require('hardhat');
const { hex, ZERO_ADDRESS, ETH, DEFAULT_FEE_PERCENTAGE } = require('../utils').helpers;

const ERC20Mock = artifacts.require('ERC20Mock');
const ERC20BlacklistableMock = artifacts.require('ERC20BlacklistableMock');
const GatewayMock = artifacts.require('GatewayMock');
const Distributor = artifacts.require('Distributor');

const [, treasury] = accounts;

async function setup () {

  const nxmToken = await ERC20Mock.new();
  const dai = await ERC20BlacklistableMock.new();
  const gateway = await GatewayMock.new();
  const distributor = await Distributor.new(
    gateway.address,
    nxmToken.address,
    ZERO_ADDRESS,
    DEFAULT_FEE_PERCENTAGE,
    treasury,
    'UnitTestToken',
    'UTT',
  );
  this.contracts = {
    nxmToken,
    gateway,
    distributor,
    dai,
  };
}

module.exports = {
  setup,
};
