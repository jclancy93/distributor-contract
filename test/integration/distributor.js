const { accounts, web3, artifacts } = require('hardhat');
const { ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const Decimal = require('decimal.js');
const { getSignedQuote } = require('./external').getQuote;
const { coverToCoverDetailsArray } = require('./external');
const { toBN } = web3.utils;
const { hex } = require('../utils').helpers;
const BN = web3.utils.BN;

const { enrollMember } = require('./external').enroll;

const DistributorFactory = artifacts.require('DistributorFactory');
const Distributor = artifacts.require('Distributor');

const [, member1, member2, member3, coverHolder, distributorOwner, nonOwner ] = accounts;

const DEFAULT_FEE_PERCENTAGE = 500; // 5%

const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

async function buyCover ({ cover, coverHolder, distributor, qt, assetToken }) {

  const basePrice = new BN(cover.price);
  // encoded data and signature uses unit price.
  const unitAmount = toBN(cover.amount).div(ether('1')).toString();
  const [v, r, s] = await getSignedQuote(
    coverToCoverDetailsArray({...cover, amount: unitAmount }),
    cover.currency,
    cover.period,
    cover.contractAddress,
    qt.address,
  );
  const data = web3.eth.abi.encodeParameters(
    ['uint', 'uint', 'uint', 'uint', 'uint8', 'bytes32', 'bytes32'],
    [basePrice, cover.priceNXM, cover.expireTime, cover.generationTime, v, r, s]
  );
  const priceWithFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000).add(basePrice);

  let tx;
  if (cover.asset === ETH) {
    tx = await distributor.buyCover(
      cover.contractAddress,
      cover.asset,
      cover.amount,
      cover.period,
      cover.type,
      data, {
        from :coverHolder,
        value: priceWithFee
      });
  } else {
    await assetToken.approve(distributor.address, priceWithFee, {
      from: coverHolder
    });
    tx = await distributor.buyCover(
      cover.contractAddress,
      cover.asset,
      cover.amount,
      cover.period,
      cover.type,
      data, {
        from :coverHolder
      });
  }

  return tx;
}


describe('Distributor', function () {

  beforeEach(async function () {
    const { master, td, mr, tk, tc } = this.contracts;
    // console.log(this.contracts);
    await enrollMember(this.contracts, [member1, member2, member3, coverHolder]);

    const distributorFactory = await DistributorFactory.new(master.address);

    const joiningFee = ether('0.002');
    const tx = await distributorFactory.newDistributor(DEFAULT_FEE_PERCENTAGE, { from: distributorOwner, value: joiningFee });
    assert.equal(tx.logs.length, 1);
    const distributorAddress = tx.logs[0].args.contractAddress;

    const initialTokens = ether('2500');
    await mr.kycVerdict(distributorAddress, true);
    await tk.transfer(distributorAddress, toBN(initialTokens));

    const distributor = await Distributor.at(distributorAddress);
    await distributor.approveNXM(tc.address, ether('1000000'), {
      from: distributorOwner
    });

    this.contracts.distributor = distributor;
  });

  it('sells ETH cover to coverHolder successfully', async function () {
    const { p1: pool, distributor, cover: coverContract, qd, qt } = this.contracts;

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

    const buyCoverTx = await buyCover({ cover, coverHolder, distributor, qt });

    const expectedCoverId = 1;

    expectEvent(buyCoverTx, 'CoverBought', {
      coverId: expectedCoverId.toString(),
      buyer: coverHolder,
      contractAddress: cover.contractAddress,
    });

    const createdCover = await coverContract.getCover(expectedCoverId);
    console.log(createdCover);
    assert.equal(createdCover.sumAssured.toString(), cover.amount.toString());
    assert.equal(createdCover.coverPeriod.toString(), cover.period);
    assert.equal(createdCover.contractAddress, cover.contractAddress);
    assert.equal(createdCover.coverAsset, cover.asset);
    assert.equal(createdCover.premiumNXM.toString(), cover.priceNXM);
    assert.equal(createdCover.payout.toString(), cover.amount.toString());
    // assert.equal(createdCover.validUntil.toString(), cover.expireTime);
  });

  it('sells DAI cover to coverHolder successfully', async function () {
    const { p1: pool, distributor, cover: coverContract, qd, qt, dai } = this.contracts;

    const cover = {
      amount: ether('10000'),
      price: '3362445813369838',
      priceNXM: '744892736679184',
      expireTime: '7972408607',
      generationTime: '7972408607001',
      asset: dai.address,
      currency: hex('DAI'),
      period: 120,
      type: 0,
      contractAddress: '0xd0a6E6C54DbC68Db5db3A091B171A77407Ff7ccf',
    };

    const buyerDAIFunds = ether('20000');
    await dai.mint(coverHolder, buyerDAIFunds, {
      from: coverHolder
    });

    const buyCoverTx = await buyCover({ cover, coverHolder, distributor, qt, assetToken: dai });

    const expectedCoverId = 1;

    expectEvent(buyCoverTx, 'CoverBought', {
      coverId: expectedCoverId.toString(),
      buyer: coverHolder,
      contractAddress: cover.contractAddress,
    });

    const createdCover = await coverContract.getCover(expectedCoverId);
    console.log(createdCover);
    assert.equal(createdCover.sumAssured.toString(), cover.amount.toString());
    assert.equal(createdCover.coverPeriod.toString(), cover.period);
    assert.equal(createdCover.contractAddress, cover.contractAddress);
    assert.equal(createdCover.coverAsset, cover.asset);
    assert.equal(createdCover.premiumNXM.toString(), cover.priceNXM);
    assert.equal(createdCover.payout.toString(), cover.amount.toString());
  });

  it('allows setting the fee percentage by owner', async function () {
    const { distributor } = this.contracts;

    const newFeePercentage = '20000';

    const storedFeePercentage = await distributor.setFeePercentage(newFeePercentage, {
      from: distributorOwner
    });
    assert(storedFeePercentage.toString(), newFeePercentage);
  });

  it('disallows setting the fee percentage by non-owner', async function () {
    const { distributor } = this.contracts;

    const newFeePercentage = '20000';

    await expectRevert(
      distributor.setFeePercentage(newFeePercentage, {
        from: nonOwner
      }),
      'Ownable: caller is not the owner'
    );
  });
});
