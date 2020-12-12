const { accounts, web3, artifacts } = require('hardhat');
const { ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const Decimal = require('decimal.js');
const { getSignedQuote } = require('./external').getQuote;
const { coverToCoverDetailsArray } = require('./external');
const { toBN } = web3.utils;
const { hex } = require('../utils').helpers;
const BN = web3.utils.BN;

const { enrollMember, enrollClaimAssessor } = require('./external').enroll;

const DistributorFactory = artifacts.require('DistributorFactory');
const Distributor = artifacts.require('Distributor');

const [, member1, member2, member3, coverHolder, distributorOwner, nonOwner, bank ] = accounts;

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

async function voteOnClaim({ claimId, verdict, cl, cd, master, voter }) {
  await cl.submitCAVote(claimId, verdict, { from: voter });

  const minVotingTime = await cd.minVotingTime();
  await time.increase(minVotingTime.addn(1));

  const voteStatusBefore = await cl.checkVoteClosing(claimId);
  assert.equal(voteStatusBefore.toString(), '1', 'should allow vote closing');

  await master.closeClaim(claimId);
  const voteStatusAfter = await cl.checkVoteClosing(claimId);
  assert(voteStatusAfter.eqn(-1), 'voting should be closed');
}


describe('Distributor', function () {

  beforeEach(async function () {
    const { master, td, mr, tk, tc } = this.contracts;
    // console.log(this.contracts);
    await enrollMember(this.contracts, [member1, member2, member3, coverHolder]);
    await enrollClaimAssessor(this.contracts, [member1, member2, member3]);

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
      feePercentage: DEFAULT_FEE_PERCENTAGE.toString()
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
      feePercentage: DEFAULT_FEE_PERCENTAGE.toString()
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

  it('allows claim submission for ETH cover and rejects resubmission while unresolved', async function () {
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

    await buyCover({ cover, coverHolder, distributor, qt });
    const expectedCoverId = 1;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);
    const tx = await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder
    });

    expectEvent(tx, 'ClaimSubmitted', {
      coverId: expectedCoverId.toString(),
      claimId: expectedClaimId.toString(),
      submitter: coverHolder
    });

    await expectRevert(
      distributor.submitClaim(expectedCoverId, emptyData, {
        from: coverHolder
      }),
      'Cover: Claim already submitted'
    );
  });

  it('allows claim reedeem for accepted ETH cover', async function () {
    const { p1: pool, distributor, cover: coverContract, qd, qt, cd, cl, master } = this.contracts;

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

    await buyCover({ cover, coverHolder, distributor, qt });
    const expectedCoverId = 1;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);

    const distributorEthBalanceBeforePayout = toBN(await web3.eth.getBalance(distributor.address));
    const tx = await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder
    });

    await voteOnClaim({...this.contracts, claimId: expectedClaimId, verdict: '1', voter: member1 });

    const payoutCompleted = await coverContract.payoutIsCompleted(expectedClaimId);
    assert(payoutCompleted);

    const distributorEthBalanceAfterPayout = toBN(await web3.eth.getBalance(distributor.address));

    const payoutAmount = distributorEthBalanceAfterPayout.sub(distributorEthBalanceBeforePayout);
    assert.equal(payoutAmount.toString(), cover.amount);

    const coverHolderEthBalanceBefore = toBN(await web3.eth.getBalance(coverHolder));
    await distributor.redeemClaim(expectedClaimId, {
      from: coverHolder,
      gasPrice: 0
    });
    const coverHolderEthBalanceAfter = toBN(await web3.eth.getBalance(coverHolder));
    const redeemedAmount = coverHolderEthBalanceAfter.sub(coverHolderEthBalanceBefore);
    assert.equal(redeemedAmount.toString(), cover.amount);
  });

  it('allows claim reedeem for accepted DAI cover', async function () {
    const { p1: pool, distributor, cover: coverContract, qd, qt, dai } = this.contracts;

    const cover = {
      amount: ether('1000'),
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

    await buyCover({ cover, coverHolder, distributor, qt, assetToken: dai });
    const expectedCoverId = 1;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);

    const distributorEthBalanceBeforePayout = await dai.balanceOf(distributor.address);
    const tx = await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder
    });

    await voteOnClaim({...this.contracts, claimId: expectedClaimId, verdict: '1', voter: member1 });

    const payoutCompleted = await coverContract.payoutIsCompleted(expectedClaimId);
    assert(payoutCompleted);

    const distributorDAIBalanceAfterPayout = await dai.balanceOf(distributor.address);

    const payoutAmount = distributorDAIBalanceAfterPayout.sub(distributorEthBalanceBeforePayout);
    assert.equal(payoutAmount.toString(), cover.amount);

    const coverHolderDAIBalanceBefore =  await dai.balanceOf(coverHolder);
    await distributor.redeemClaim(expectedClaimId, {
      from: coverHolder,
      gasPrice: 0
    });
    const coverHolderDAIBalanceAfter = await dai.balanceOf(coverHolder);
    const redeemedAmount = coverHolderDAIBalanceAfter.sub(coverHolderDAIBalanceBefore);
    assert.equal(redeemedAmount.toString(), cover.amount);
  });

  it('allows distributor owner to withdraw ETH fees from bought covers', async function () {
    const { p1: pool, distributor, cover: coverContract, qd, qt, dai } = this.contracts;

    let generationTime = 7972408607001;

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

    const ethCoversCount = 2;
    for (let i = 0; i < ethCoversCount; i++) {
      const cover = { ...ethCoverTemplate, generationTime: generationTime++ };
      await buyCover({ cover, coverHolder, distributor, qt });
    }

    const ethWithdrawAmount = toBN(ethCoverTemplate.price).muln(DEFAULT_FEE_PERCENTAGE).divn(10000).muln(ethCoversCount);
    const withdrawableEth = await distributor.withdrawableTokens(ETH);
    assert.equal(withdrawableEth.toString(), ethWithdrawAmount.toString());

    const ethBalanceBefore = toBN(await web3.eth.getBalance(bank));
    await distributor.withdrawEther(bank, ethWithdrawAmount, {
      from: distributorOwner
    });
    const ethBalanceAfter = toBN(await web3.eth.getBalance(bank));
    assert.equal(ethBalanceAfter.sub(ethBalanceBefore).toString(), ethWithdrawAmount);
  });

  it('allows distributor owner to withdraw DAI fees from bought covers', async function () {
    const { p1: pool, distributor, cover: coverContract, qd, qt, dai } = this.contracts;

    let generationTime = 7972408607001;

    const daiCoverTemplate = {
      amount: ether('1000'),
      price: '53624458133698380',
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
    const daiCoversCount = 2;
    for (let i = 0; i < daiCoversCount; i++) {
      const cover = { ...daiCoverTemplate, generationTime: generationTime++ };
      await buyCover({ cover, coverHolder, distributor, qt, assetToken: dai });
    }

    const daiWithdrawAmount = toBN(daiCoverTemplate.price).muln(DEFAULT_FEE_PERCENTAGE).divn(10000).muln(daiCoversCount);
    const withdrawableDAI = await distributor.withdrawableTokens(dai.address);
    assert.equal(withdrawableDAI.toString(), daiWithdrawAmount.toString());

    const daiBalanceBefore = await dai.balanceOf(bank);
    await distributor.withdrawTokens(bank, daiWithdrawAmount, dai.address, {
      from: distributorOwner
    });
    const daiBalanceAfter = await dai.balanceOf(bank);
    assert.equal(daiBalanceAfter.sub(daiBalanceBefore).toString(), daiWithdrawAmount);
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
