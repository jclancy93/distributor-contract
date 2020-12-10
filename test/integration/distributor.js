const { accounts, web3, artifacts } = require('hardhat');
const { ether, expectRevert, time } = require('@openzeppelin/test-helpers');
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

const [, member1, member2, member3, coverHolder, nonMember1, distributorOwner ] = accounts;

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
    await assetToken.approve(priceWithFee, distributor.address, {
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


  const coverId = tx.logs[0].args.coverId;
  return coverId;
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
      amount: ether('1'),
      price: '3362445813369838',
      priceNXM: '744892736679184',
      expireTime: '7972408607',
      generationTime: '7972408607001',
      asset: ETH,
      currency: hex('ETH'),
      period: 120,
      type: 0,
      contractAddress: '0xd0a6e6c54dbc68db5db3a091b171a77407ff7ccf',
    };

    const coverId = await buyCover({ cover, coverHolder, distributor, qt });

    // const cover = await coverContract.getCover(coverId);
    console.log(cover);
    assert(true);
  });
});
