const { accounts, web3, artifacts } = require('hardhat');
const { ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const { toBN } = web3.utils;
const { hex, ZERO_ADDRESS, ETH, DEFAULT_FEE_PERCENTAGE } = require('../utils').helpers;
const BN = web3.utils.BN;
const Distributor = artifacts.require('Distributor');

const [, member1, member2, member3, coverHolder, distributorOwner, nonOwner, bank] = accounts;


describe('buyCover', function () {

  const ethCoverTemplate = {
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

  const daiCoverTemplate = {
    amount: ether('10000'),
    price: '3362445813369838',
    priceNXM: '744892736679184',
    expireTime: '7972408607',
    generationTime: '7972408607001',
    currency: hex('DAI'),
    period: 120,
    type: 0,
    contractAddress: '0xd0a6E6C54DbC68Db5db3A091B171A77407Ff7ccf',
  };

  it('rejects buyCover if allowBuys = false', async function () {
    const { distributor, cover: coverContract } = this.contracts;

    const cover = { ...ethCoverTemplate };
    const basePrice = toBN(cover.price);
    const priceWithFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000).add(basePrice);

    const data = web3.eth.abi.encodeParameters(['uint'], [basePrice]);

    await distributor.setBuysAllowed(false);

    expectRevert(
      distributor.buyCover(
        cover.contractAddress,
        cover.asset,
        cover.amount,
        cover.period,
        cover.type,
        data, {
          from: coverHolder,
          value: priceWithFee,
        }),
      'Distributor: buys not allowed',
    );
  });

  it('foo buy', async function () {
    const { distributor, cover: coverContract } = this.contracts;

    const cover = { ...ethCoverTemplate };
    const basePrice = toBN(cover.price);
    const expectedFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000);
    const priceWithFee = expectedFee.add(basePrice);

    const data = web3.eth.abi.encodeParameters(['uint'], [basePrice]);

    const buyCoverTx = await distributor.buyCover(
      cover.contractAddress,
      cover.asset,
      cover.amount,
      cover.period,
      cover.type,
      data, {
        from: coverHolder,
        value: priceWithFee,
      });
    const expectedCoverId = 1;
  });

  it('successfully buys ETH cover, mints cover token, increases available withdrawable fee amount and emits event', async function () {
    const { distributor, cover: coverContract } = this.contracts;

    const cover = { ...ethCoverTemplate };
    const basePrice = toBN(cover.price);
    const expectedFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000);
    const priceWithFee = expectedFee.add(basePrice);

    const data = web3.eth.abi.encodeParameters(['uint'], [basePrice]);

    const buyCoverTx = await distributor.buyCover(
      cover.contractAddress,
      cover.asset,
      cover.amount,
      cover.period,
      cover.type,
      data, {
        from: coverHolder,
        value: priceWithFee,
      });
    const expectedCoverId = 1;

    expectEvent(buyCoverTx, 'CoverBought', {
      coverId: expectedCoverId.toString(),
      buyer: coverHolder,
      contractAddress: cover.contractAddress,
      feePercentage: DEFAULT_FEE_PERCENTAGE.toString(),
    });

    const totalSupply = await distributor.totalSupply();
    assert.equal(totalSupply.toString(), '1');

    const tokenOwner = await distributor.ownerOf(expectedCoverId);
    assert.equal(tokenOwner, coverHolder);

    const withdrawableEther = await distributor.withdrawableTokens(ETH);
    assert.equal(withdrawableEther.toString(), expectedFee.toString());
  });

  it('successfully buys DAI cover, mints cover token, increases available withdrawable fee amount and emits event', async function () {
    const { distributor, cover: coverContract, dai } = this.contracts;

    const cover = { ...daiCoverTemplate, asset: dai.address };
    const basePrice = toBN(cover.price);
    const expectedFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000);
    const priceWithFee = expectedFee.add(basePrice);

    const data = web3.eth.abi.encodeParameters(['uint'], [basePrice]);

    await dai.mint(coverHolder, ether('1000000'), {
      from: coverHolder,
    });

    await dai.approve(distributor.address, priceWithFee, {
      from: coverHolder
    });

    const buyCoverTx = await distributor.buyCover(
      cover.contractAddress,
      cover.asset,
      cover.amount,
      cover.period,
      cover.type,
      data, {
        from: coverHolder
      });
    const expectedCoverId = 1;

    expectEvent(buyCoverTx, 'CoverBought', {
      coverId: expectedCoverId.toString(),
      buyer: coverHolder,
      contractAddress: cover.contractAddress,
      feePercentage: DEFAULT_FEE_PERCENTAGE.toString(),
    });

    const totalSupply = await distributor.totalSupply();
    assert.equal(totalSupply.toString(), '1');

    const tokenOwner = await distributor.ownerOf(expectedCoverId);
    assert.equal(tokenOwner, coverHolder);

    const withdrawableDai = await distributor.withdrawableTokens(dai.address);
    assert.equal(withdrawableDai.toString(), expectedFee.toString());
  });
});
