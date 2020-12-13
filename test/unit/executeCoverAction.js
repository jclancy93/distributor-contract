const { takeSnapshot, revertToSnapshot, reset } = require('../utils').evm;

const { accounts, web3, artifacts } = require('hardhat');
const { ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const { toBN } = web3.utils;
const { hex } = require('../utils').helpers;
const BN = web3.utils.BN;

const ERC20Mock = artifacts.require('ERC20Mock');
const CoverMock = artifacts.require('CoverMock');
const Distributor = artifacts.require('Distributor');

const DEFAULT_FEE_PERCENTAGE = 500; // 5.00%

const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const [, member1, member2, member3, coverHolder, distributorOwner, nonOwner, bank ] = accounts;

async function setup () {

  const nxmToken = await ERC20Mock.new();
  const cover = await CoverMock.new();
  const unused = '0x0000000000000000000000000000000000000023';
  const distributor = await Distributor.new(cover.address, nxmToken.address, unused, DEFAULT_FEE_PERCENTAGE);
  this.contracts = {
    nxmToken,
    cover,
    distributor
  };
}

describe('executeCoverAction', function () {

  before(reset);
  before(setup);

  beforeEach(async function () {
    this.snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(this.snapshotId);
  });

  it('executes custom action on an owned cover', async function () {
    const { distributor, cover: coverContract } = this.contracts;

    const cover = {
      amount: ether('10'),
      price: '3362445813369838',
      priceNXM: '744892736679184',
      expireTime: '7972408607',
      generationTime: '7972408607001',
      asset: ETH,
      currency: hex('ETH'),
      period: 120,
      type: 0,
      contractAddress: '0xd0a6E6C54DbC68Db5db3A091B171A77407Ff7ccf',
    };

    const basePrice = toBN(cover.price);
    const priceWithFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000).add(basePrice);

    const data = web3.eth.abi.encodeParameters(['uint'], [basePrice]);

    await distributor.buyCover(
      cover.contractAddress,
      cover.asset,
      cover.amount,
      cover.period,
      cover.type,
      data, {
        from: coverHolder,
        value: priceWithFee
      });

    const coverId = 1;

    const action = 0;
    const executeDate = web3.eth.abi.encodeParameters(['uint'], [30]);
    await distributor.executeCoverAction(coverId, action, executeDate, {
      from: coverHolder
    });

    const { fooValue } = await coverContract.covers(coverId);
    assert.equal(fooValue.toString(), '30');
  });
})
