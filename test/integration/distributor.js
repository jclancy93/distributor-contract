const { accounts, web3, artifacts } = require('hardhat');
const { ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const { getBuyCoverDataParameter, ClaimStatus } = require('./external');
const { toBN } = web3.utils;
const { hex } = require('../utils').helpers;
const BN = web3.utils.BN;

const { enrollMember, enrollClaimAssessor } = require('./external').enroll;

const DistributorFactory = artifacts.require('DistributorFactory');
const Distributor = artifacts.require('Distributor');
const ERC20BlacklistableMock = artifacts.require('ERC20BlacklistableMock');

const [, member1, member2, member3, coverHolder, distributorOwner, nonOwner, treasury, newMemberAddress] = accounts;

const DEFAULT_FEE_PERCENTAGE = 500; // 5%

const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

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

async function buyCover ({ coverData, coverHolder, distributor, qt, dai, feePercentage }) {

  const basePrice = new BN(coverData.price);

  const data = await getBuyCoverDataParameter({ qt, coverData });
  const priceWithFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE || feePercentage).divn(10000).add(basePrice);

  if (coverData.asset === ETH) {
    return await distributor.buyCover(
      coverData.contractAddress,
      coverData.asset,
      coverData.amount,
      coverData.period,
      coverData.type,
      priceWithFee,
      data, {
        from: coverHolder,
        value: priceWithFee,
      });
  } else if (coverData.asset === dai.address) {
    await dai.approve(distributor.address, priceWithFee, {
      from: coverHolder,
    });
    return distributor.buyCover(
      coverData.contractAddress,
      coverData.asset,
      coverData.amount,
      coverData.period,
      coverData.type,
      priceWithFee,
      data, {
        from: coverHolder,
      });
  }

  throw new Error(`Unknown asset: ${coverData.asset}`);
}

async function voteOnClaim ({ claimId, verdict, cl, cd, master, voter }) {
  await cl.submitCAVote(claimId, toBN(verdict), { from: voter });

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
    const { master, mr, tk, tc } = this.contracts;
    await enrollMember(this.contracts, [member1, member2, member3, coverHolder]);
    await enrollClaimAssessor(this.contracts, [member1, member2, member3]);

    const distributorFactory = await DistributorFactory.new(master.address);

    const joiningFee = ether('0.002');
    const tx = await distributorFactory.newDistributor(
      DEFAULT_FEE_PERCENTAGE,
      treasury,
      'IntegrationTestToken',
      'ITT',
      { from: distributorOwner, value: joiningFee },
    );
    assert.equal(tx.logs.length, 1);
    const distributorAddress = tx.logs[0].args.contractAddress;

    const initialTokens = ether('2500');
    await mr.kycVerdict(distributorAddress, true);
    await tk.transfer(distributorAddress, toBN(initialTokens));

    const distributor = await Distributor.at(distributorAddress);
    await distributor.approveNXM(tc.address, ether('1000000'), {
      from: distributorOwner,
    });

    this.contracts.distributor = distributor;
  });

  it('sells ETH cover to coverHolder successfully', async function () {
    const { distributor } = this.contracts;

    const coverData = { ...ethCoverTemplate };

    const buyCoverTx = await buyCover({ ...this.contracts, coverData, coverHolder });
    const expectedCoverId = 1;

    expectEvent(buyCoverTx, 'CoverBought', {
      coverId: expectedCoverId.toString(),
      buyer: coverHolder,
      contractAddress: coverData.contractAddress,
      feePercentage: DEFAULT_FEE_PERCENTAGE.toString(),
    });

    const createdCover = await distributor.getCover(expectedCoverId);
    assert.equal(createdCover.sumAssured.toString(), coverData.amount.toString());
    assert.equal(createdCover.coverPeriod.toString(), coverData.period);
    assert.equal(createdCover.contractAddress, coverData.contractAddress);
    assert.equal(createdCover.coverAsset, coverData.asset);
    assert.equal(createdCover.premiumInNXM.toString(), coverData.priceNXM);
    // assert.equal(createdCover.validUntil.toString(), cover.expireTime);
  });

  it('sells DAI cover to coverHolder successfully', async function () {
    const { gateway, dai } = this.contracts;

    const coverData = { ...daiCoverTemplate, asset: dai.address };

    const buyerDAIFunds = ether('20000');
    await dai.mint(coverHolder, buyerDAIFunds);

    const buyCoverTx = await buyCover({ ...this.contracts, coverData, coverHolder });

    const expectedCoverId = 1;
    expectEvent(buyCoverTx, 'CoverBought', {
      coverId: expectedCoverId.toString(),
      buyer: coverHolder,
      contractAddress: coverData.contractAddress,
      feePercentage: DEFAULT_FEE_PERCENTAGE.toString(),
    });

    const createdCover = await gateway.getCover(expectedCoverId);
    assert.equal(createdCover.sumAssured.toString(), coverData.amount.toString());
    assert.equal(createdCover.coverPeriod.toString(), coverData.period);
    assert.equal(createdCover.contractAddress, coverData.contractAddress);
    assert.equal(createdCover.coverAsset, coverData.asset);
    assert.equal(createdCover.premiumInNXM.toString(), coverData.priceNXM);
  });

  it('reverts when cover asset is not supported', async function () {
    const { distributor, qt } = this.contracts;

    const unsupportedToken = await ERC20BlacklistableMock.new();

    const coverData = {
      amount: ether('10000'),
      price: '3362445813369838',
      priceNXM: '744892736679184',
      expireTime: '7972408607',
      generationTime: '7972408607001',
      asset: unsupportedToken.address,
      currency: hex('UTK'),
      period: 120,
      type: 0,
      contractAddress: '0xd0a6E6C54DbC68Db5db3A091B171A77407Ff7ccf',
    };

    const buyerTokenFunds = ether('20000');
    await unsupportedToken.mint(coverHolder, buyerTokenFunds);

    const basePrice = new BN(coverData.price);

    const data = await getBuyCoverDataParameter({ qt, coverData });
    const priceWithFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000).add(basePrice);

    await unsupportedToken.approve(distributor.address, priceWithFee, {
      from: coverHolder,
    });
    await expectRevert(
      distributor.buyCover(
        coverData.contractAddress,
        coverData.asset,
        coverData.amount,
        coverData.period,
        coverData.type,
        priceWithFee,
        data, {
          from: coverHolder,
        }),
      'Cover: unknown asset',
    );
  });

  it('reverts if max price with fee max is exceeded', async function () {
    const { distributor, qt } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    const basePrice = toBN(coverData.price);

    const data = await getBuyCoverDataParameter({ qt, coverData });
    const priceWithFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000).add(basePrice);

    await expectRevert(
      distributor.buyCover(
        coverData.contractAddress,
        coverData.asset,
        coverData.amount,
        coverData.period,
        coverData.type,
        priceWithFee.subn(1),
        data, {
          from: coverHolder,
          value: priceWithFee,
        }),
      'Distributor: cover price with fee exceeds max',
    );
  });

  it('reverts if ETH amount is not whole unit', async function () {
    const { distributor, qt } = this.contracts;

    const coverData = { ...ethCoverTemplate, amount: ether('10').addn(1) };
    const basePrice = toBN(coverData.price);

    const data = await getBuyCoverDataParameter({ qt, coverData });
    const priceWithFee = basePrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000).add(basePrice);

    await expectRevert(
      distributor.buyCover(
        coverData.contractAddress,
        coverData.asset,
        coverData.amount,
        coverData.period,
        coverData.type,
        priceWithFee,
        data, {
          from: coverHolder,
          value: priceWithFee,
        }),
      'Cover: Only whole unit sumAssured supported',
    );
  });

  it('allows claim submission for ETH cover and rejects resubmission while in-progress', async function () {
    const { distributor } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    await buyCover({ ...this.contracts, coverData, coverHolder });
    const expectedCoverId = 1;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);
    const tx = await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder,
    });

    expectEvent(tx, 'ClaimSubmitted', {
      coverId: expectedCoverId.toString(),
      claimId: expectedClaimId.toString(),
      submitter: coverHolder,
    });

    await expectRevert(
      distributor.submitClaim(expectedCoverId, emptyData, {
        from: coverHolder,
      }),
      'VM Exception while processing transaction: revert TokenController: Cover already has an open claim',
    );
  });

  it('allows claim reedeem for accepted ETH cover', async function () {
    const { distributor } = this.contracts;

    const coverData = { ...ethCoverTemplate };

    // pre-existing cover purchase
    await buyCover({ ...this.contracts, coverData, coverHolder });

    await buyCover({ ...this.contracts, coverData:  { ...coverData, generationTime: coverData.generationTime + 1 }, coverHolder });
    const expectedCoverId = 2;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);

    const distributorEthBalanceBeforePayout = toBN(await web3.eth.getBalance(distributor.address));
    await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder,
    });

    await voteOnClaim({ ...this.contracts, claimId: expectedClaimId, verdict: '1', voter: member1 });

    const { status, amountPaid, coverAsset } = await distributor.getPayoutOutcome(expectedClaimId);
    assert.equal(status.toString(), ClaimStatus.ACCEPTED);
    assert.equal(amountPaid.toString(), coverData.amount.toString());
    assert.equal(coverAsset, coverData.asset);

    const distributorEthBalanceAfterPayout = toBN(await web3.eth.getBalance(distributor.address));

    const payoutAmount = distributorEthBalanceAfterPayout.sub(distributorEthBalanceBeforePayout);
    assert.equal(payoutAmount.toString(), coverData.amount);

    const coverHolderEthBalanceBefore = toBN(await web3.eth.getBalance(coverHolder));
    await distributor.redeemClaim(expectedCoverId, expectedClaimId, {
      from: coverHolder,
      gasPrice: 0,
    });
    const coverHolderEthBalanceAfter = toBN(await web3.eth.getBalance(coverHolder));
    const redeemedAmount = coverHolderEthBalanceAfter.sub(coverHolderEthBalanceBefore);
    assert.equal(redeemedAmount.toString(), coverData.amount);
  });

  it('reverts on redeem while claim is IN_PROGRESS', async function () {
    const { distributor } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    await buyCover({ ...this.contracts, coverData, coverHolder });
    const expectedCoverId = 1;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);

    await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder,
    });

    await expectRevert(
        distributor.redeemClaim(expectedCoverId, expectedClaimId, {
          from: coverHolder,
          gasPrice: 0,
        }),
      'Distributor: Claim not accepted'
    );

    const { status, amountPaid, coverAsset } = await distributor.getPayoutOutcome(expectedClaimId);
    assert.equal(status.toString(), ClaimStatus.IN_PROGRESS);
    assert.equal(amountPaid.toString(), '0');
    assert.equal(coverAsset, coverData.asset);
  });

  it('reverts on redeem if claim is REJECTED', async function () {
    const { distributor } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    await buyCover({ ...this.contracts, coverData, coverHolder });
    const expectedCoverId = 1;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);

    await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder,
    });

    await voteOnClaim({ ...this.contracts, claimId: expectedClaimId, verdict: '-1', voter: member1 });

    await expectRevert(
      distributor.redeemClaim(expectedCoverId, expectedClaimId, {
        from: coverHolder,
        gasPrice: 0,
      }),
      'Distributor: Claim not accepted'
    );

    const { status, amountPaid, coverAsset } = await distributor.getPayoutOutcome(expectedClaimId);
    assert.equal(status.toString(), ClaimStatus.REJECTED);
    assert.equal(amountPaid.toString(), '0');
    assert.equal(coverAsset, coverData.asset);
  });

  it('reverts on double-redeem', async function () {
    const { distributor } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    await buyCover({ ...this.contracts, coverData, coverHolder });
    const expectedCoverId = 1;
    const expectedClaimId = 1;
    const emptyData = web3.eth.abi.encodeParameters([], []);
    await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder,
    });
    await voteOnClaim({ ...this.contracts, claimId: expectedClaimId, verdict: '1', voter: member1 });

    const { status } = await distributor.getPayoutOutcome(expectedClaimId);
    assert.equal(status.toString(), ClaimStatus.ACCEPTED);
    await distributor.redeemClaim(expectedCoverId, expectedClaimId, {
      from: coverHolder,
      gasPrice: 0,
    });

    // cannot be redeemed twice
    await expectRevert(
      distributor.redeemClaim(expectedCoverId, expectedClaimId, {
        from: coverHolder,
      }),
      'VM Exception while processing transaction: revert ERC721: operator query for nonexistent token',
    );
  });

  it('allows claim reedeem for accepted DAI cover', async function () {
    const { distributor, dai } = this.contracts;

    const coverData = {
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
    await dai.mint(coverHolder, buyerDAIFunds);

    // pre-existing cover purchase
    await buyCover({ ...this.contracts, coverData, coverHolder });
    await buyCover({ ...this.contracts, coverData:  { ...coverData, generationTime: coverData.generationTime + 1 }, coverHolder });
    const expectedCoverId = 2;
    const expectedClaimId = 1;

    const emptyData = web3.eth.abi.encodeParameters([], []);

    const distributorEthBalanceBeforePayout = await dai.balanceOf(distributor.address);
    await distributor.submitClaim(expectedCoverId, emptyData, {
      from: coverHolder,
    });

    await voteOnClaim({ ...this.contracts, claimId: expectedClaimId, verdict: '1', voter: member1 });

    const { status, amountPaid, coverAsset } = await distributor.getPayoutOutcome(expectedClaimId);
    assert.equal(status.toString(), ClaimStatus.ACCEPTED);
    assert.equal(amountPaid.toString(), coverData.amount.toString());
    assert.equal(coverAsset, coverData.asset);

    const distributorDAIBalanceAfterPayout = await dai.balanceOf(distributor.address);

    const payoutAmount = distributorDAIBalanceAfterPayout.sub(distributorEthBalanceBeforePayout);
    assert.equal(payoutAmount.toString(), coverData.amount);

    const coverHolderDAIBalanceBefore = await dai.balanceOf(coverHolder);
    await distributor.redeemClaim(expectedCoverId, expectedClaimId, {
      from: coverHolder,
      gasPrice: 0,
    });
    const coverHolderDAIBalanceAfter = await dai.balanceOf(coverHolder);
    const redeemedAmount = coverHolderDAIBalanceAfter.sub(coverHolderDAIBalanceBefore);
    assert.equal(redeemedAmount.toString(), coverData.amount);
  });

  it('sends ETH fees from bought covers to treasury', async function () {
    const { distributor, qt } = this.contracts;

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

    const treasuryEthBalanceBefore = toBN(await web3.eth.getBalance(treasury));
    const ethCoversCount = 2;
    for (let i = 0; i < ethCoversCount; i++) {
      const coverData = { ...ethCoverTemplate, generationTime: generationTime++ };
      await buyCover({ ...this.contracts, coverData, coverHolder, distributor, qt });
    }

    const expectedFeeProfits = toBN(ethCoverTemplate.price).muln(DEFAULT_FEE_PERCENTAGE).divn(10000).muln(ethCoversCount);
    const treasuryEthBalanceAfter = toBN(await web3.eth.getBalance(treasury));
    assert.equal(treasuryEthBalanceAfter.sub(treasuryEthBalanceBefore).toString(), expectedFeeProfits.toString());
  });

  it('sends DAI fees from bought covers to treasury', async function () {
    const { dai } = this.contracts;

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
    await dai.mint(coverHolder, buyerDAIFunds);
    const daiCoversCount = 2;
    let totalPrice = toBN('0');
    for (let i = 0; i < daiCoversCount; i++) {

      const price = toBN(daiCoverTemplate.price).muln(i + 1);
      const coverData = {
        ...daiCoverTemplate,
        generationTime: generationTime++,
        price: price.toString(),
      };
      totalPrice = totalPrice.add(price);
      await buyCover({ ...this.contracts, coverData, coverHolder });
    }

    const expectedFeeProfits = totalPrice.muln(DEFAULT_FEE_PERCENTAGE).divn(10000);
    const treasuryDAI = await dai.balanceOf(treasury);
    assert.equal(treasuryDAI.toString(), expectedFeeProfits.toString());
  });

  it('contains NXM deposit after cover expiry', async function () {
    const { distributor, qt: quotation, tk: token, tc: tokenController } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    await buyCover({ ...this.contracts, coverData, coverHolder });
    const expectedCoverId = 1;
    await time.increase((coverData.period + 1) * 24 * 3600);

    const nxmBalanceBeforeExpiry = await token.balanceOf(distributor.address);
    await quotation.expireCover(expectedCoverId);

    const gracePeriod = await tokenController.claimSubmissionGracePeriod();
    await time.increase(gracePeriod);
    await quotation.withdrawCoverNote(distributor.address, [expectedCoverId], ['0']);

    const nxmBalanceAfterExpiry = await token.balanceOf(distributor.address);
    const returnedNXM = nxmBalanceAfterExpiry.sub(nxmBalanceBeforeExpiry);
    assert.equal(returnedNXM.toString(), toBN(coverData.priceNXM).divn(10).toString());
  });

  it('rejects a claim after cover expiration and grace period passed', async function () {
    const { distributor, qt: quotation, tc: tokenController } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    await buyCover({ ...this.contracts, coverData, coverHolder });
    const expectedCoverId = 1;
    await time.increase((coverData.period + 1) * 24 * 3600);

    await quotation.expireCover(expectedCoverId);
    const gracePeriod = await tokenController.claimSubmissionGracePeriod();
    await time.increase(gracePeriod);

    const emptyData = web3.eth.abi.encodeParameters([], []);
    await expectRevert(
      distributor.submitClaim(expectedCoverId, emptyData, {
        from: coverHolder,
      }),
      'VM Exception while processing transaction: revert Claims: Grace period has expired',
    );
  });

  it('allows transferring out NXM through the use of .approve', async function () {
    const { distributor, tk: token } = this.contracts;

    const nxmToBeTransferred = ether('100');

    const distributorBalanceBefore = await token.balanceOf(distributor.address);
    await distributor.approveNXM(member1, nxmToBeTransferred, {
      from: distributorOwner,
    });

    await token.transferFrom(distributor.address, member1, nxmToBeTransferred, {
      from: member1,
    });

    const distributorBalanceAfter = await token.balanceOf(distributor.address);
    assert.equal(distributorBalanceBefore.sub(distributorBalanceAfter).toString(), nxmToBeTransferred.toString());
  });

  it('allows transferring out NXM with transferNXM', async function () {
    const { distributor, tk: token } = this.contracts;

    const nxmToBeTransferred = ether('100');

    const distributorBalanceBefore = await token.balanceOf(distributor.address);
    await distributor.withdrawNXM(member1, nxmToBeTransferred, {
      from: distributorOwner,
    });

    const distributorBalanceAfter = await token.balanceOf(distributor.address);
    assert.equal(distributorBalanceBefore.sub(distributorBalanceAfter).toString(), nxmToBeTransferred.toString());
  });

  it('allows selling of NXM', async function () {
    const { distributor, tk: token, p1: pool } = this.contracts;

    const nxmToBeSold = ether('100');

    const expectedEth = await pool.getEthForNXM(nxmToBeSold);
    const distributorBalanceBefore = await token.balanceOf(distributor.address);

    const treasuryEthBalanceBefore = toBN(await web3.eth.getBalance(treasury));
    await distributor.sellNXM(nxmToBeSold, expectedEth, {
      from: distributorOwner,
      gasPrice: 0,
    });

    const distributorBalanceAfter = await token.balanceOf(distributor.address);
    assert.equal(distributorBalanceBefore.sub(distributorBalanceAfter).toString(), nxmToBeSold.toString());

    const treasuryEthBalanceAfter = toBN(await web3.eth.getBalance(treasury));
    assert.equal(treasuryEthBalanceAfter.sub(treasuryEthBalanceBefore).toString(), expectedEth.toString());
  });

  it('allows switching membership to another address', async function () {
    const { distributor, master, tk } = this.contracts;

    const oldAddressBalance = await tk.balanceOf(distributor.address);
    await distributor.switchMembership(newMemberAddress, {
      from: distributorOwner,
    });

    const newAddressIsMember = await master.isMember(newMemberAddress);
    const distributorIsStillMember = await master.isMember(distributor.address);
    assert(newAddressIsMember);
    assert(!distributorIsStillMember);

    const newAddressBalance = await tk.balanceOf(newMemberAddress);
    assert.equal(newAddressBalance.toString(), oldAddressBalance.toString());
  });

  it('allows setting the fee percentage by owner', async function () {
    const { distributor } = this.contracts;

    const newFeePercentage = '20000';

    await distributor.setFeePercentage(newFeePercentage, {
      from: distributorOwner,
    });

    const storedFeePercentage = await distributor.feePercentage();
    assert(storedFeePercentage.toString(), newFeePercentage);
  });

  it('allows purchases with 0% fee percentage', async function () {
    const { distributor } = this.contracts;

    const newFeePercentage = '0';

    distributor.setFeePercentage(newFeePercentage, {
      from: distributorOwner,
    });
    const storedFeePercentage = await distributor.feePercentage();
    assert(storedFeePercentage.toString(), newFeePercentage);

    const coverData = { ...ethCoverTemplate };

    await buyCover({ ...this.contracts, coverData, coverHolder, feePercentage: newFeePercentage });
  });

  it('disallows setting the fee percentage by non-owner', async function () {
    const { distributor } = this.contracts;

    const newFeePercentage = '20000';

    await expectRevert(
      distributor.setFeePercentage(newFeePercentage, {
        from: nonOwner,
      }),
      'Ownable: caller is not the owner',
    );
  });

  it('reverts on executeCoverAction - no action supported at this time', async function () {
    const { distributor } = this.contracts;

    const coverData = { ...ethCoverTemplate };
    await buyCover({ ...this.contracts, coverData, coverHolder });
    const coverId = 1;

    const ethAmount = ether('1');
    const action = 0;
    const executeData = web3.eth.abi.encodeParameters(['uint'], [ethAmount.toString()]);
    await expectRevert(
      distributor.executeCoverAction(coverId, ethAmount, ETH, action, executeData, {
        from: coverHolder,
        value: ethAmount,
      }),
      'Unsupported action',
    );
  });
});
