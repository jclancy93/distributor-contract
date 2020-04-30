const { contract, accounts, defaultSender, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, ether, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
require('chai').should();

const Distributor = contract.fromArtifact('Distributor');

const getValue = require('../nexusmutual-contracts/test/utils/getMCRPerThreshold.js').getValue;
const getQuoteValues = require('../nexusmutual-contracts/test/utils/getQuote.js').getQuoteValues;

const setup = require('./utils/setup');
const { hex } = require('./utils/helpers');


const BN = web3.utils.BN;

function toWei(value) {
  return web3.utils.toWei(value, 'ether');
}

function toHex(value) {
  return web3.utils.toHex(value);
}


const duration = {
  seconds: function(val) {
    return val;
  },
  minutes: function(val) {
    return val * this.seconds(60);
  },
  hours: function(val) {
    return val * this.minutes(60);
  },
  days: function(val) {
    return val * this.hours(24);
  },
  weeks: function(val) {
    return val * this.days(7);
  },
  years: function(val) {
    return val * this.days(365);
  }
};

const CA_ETH = '0x45544800';
const CLA = '0x434c41';
const fee = ether('0.002');
const smartConAdd = '0xd0a6e6c54dbc68db5db3a091b171a77407ff7ccf';
const coverPeriod = 61;
const coverDetails = [10, '3362445813369838', '744892736679184', '7972408607'];
const v = 28;
const r = '0x66049184fb1cf394862cca6c3b2a0c462401a671d0f2b20597d121e56768f90a';
const s = '0x4c28c8f8ff0548dd3a41d7c75621940eb4adbac13696a2796e98a59691bf53ff';

const coverDetailsDai = [5, '16812229066849188', '5694231991898', '7972408607'];
const vrs_dai = [
  27,
  '0xdcaa177410672d90890f1c0a42a965b3af9026c04caedbce9731cb43827e8556',
  '0x2b9f34e81cbb79f9af4b8908a7ef8fdb5875dedf5a69f84cd6a80d2a4cc8efff'
];

const distributorFeePercentage = 10;
const percentageDenominator = 100;
const coverPriceMultiplier = percentageDenominator + distributorFeePercentage;

const coverBasePrice = new web3.utils.BN(coverDetails[1]);
const buyCoverValue = coverBasePrice
  .mul(new web3.utils.BN(coverPriceMultiplier))
  .div(new web3.utils.BN(percentageDenominator));
const buyCoverFee = buyCoverValue.sub(coverBasePrice);

const coverBaseDaiPrice = new web3.utils.BN(coverDetailsDai[1]);
const buyCoverDaiValue = coverBaseDaiPrice
  .mul(new web3.utils.BN(coverPriceMultiplier))
  .div(new web3.utils.BN(percentageDenominator));
const buyCoverDaiFee = buyCoverDaiValue.sub(coverBaseDaiPrice);

function getCoverDataFromBuyCoverLogs(logs) {
  logs = Array.from(logs);
  const transferEvent = logs.filter(log => log.event === 'Transfer')[0];
  return {
    tokenId: transferEvent.args.tokenId.toString()
  };
}

describe('Distributor', function () {
  this.timeout(10000);
  const owner = defaultSender;
  const [
    member1,
    member2,
    member3,
    staker1,
    staker2,
    coverHolder,
    nftCoverHolder1,
    distributorFeeReceiver
  ] = accounts;
  
  const stakeTokens = ether('5');
  const tokens = ether('60');
  const validity = duration.days('30');
  const UNLIMITED_ALLOWANCE = new BN((2).toString())
    .pow(new BN((256).toString()))
    .sub(new BN((1).toString()));

  async function initMembers() {
    const {mr, mcr, pd, tk, tf, cd, tc, qt, master} = this;

    const distributor = await Distributor.new(master.address, distributorFeePercentage, {
      from: coverHolder
    });
    this.distributor = distributor;

    await mr.addMembersBeforeLaunch([], []);
    (await mr.launched()).should.be.equal(true);
    await mcr.addMCRData(
      await getValue(toWei('2'), pd, mcr),
      toWei('100'),
      toWei('2'),
      ['0x455448', '0x444149'],
      [100, 65407],
      20181011, {
        from: owner
      }
    );
    (await pd.capReached()).toString().should.be.equal('1');


    await mr.payJoiningFee(member1, {from: member1, value: fee});
    await mr.kycVerdict(member1, true);
    await mr.payJoiningFee(member2, {from: member2, value: fee});
    await mr.kycVerdict(member2, true);
    await mr.payJoiningFee(member3, {from: member3, value: fee});
    await mr.kycVerdict(member3, true);
    await mr.payJoiningFee(staker1, {from: staker1, value: fee});
    await mr.kycVerdict(staker1, true);
    await mr.payJoiningFee(staker2, {from: staker2, value: fee});
    await mr.kycVerdict(staker2, true);
    await mr.payJoiningFee(coverHolder, {from: coverHolder, value: fee});
    await mr.kycVerdict(coverHolder, true);
    await mr.payJoiningFee(distributor.address, {
      from: coverHolder,
      value: fee
    });
    await mr.kycVerdict(distributor.address, true);


    await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member1});
    await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member2});
    await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member3});
    await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker1});
    await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker2});
    await tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: coverHolder});
    await distributor.nxmTokenApprove(tc.address, UNLIMITED_ALLOWANCE, {
      from: coverHolder
    })

    await tk.transfer(member1, ether('250'));
    await tk.transfer(member2, ether('250'));
    await tk.transfer(member3, ether('250'));
    await tk.transfer(coverHolder, ether('250'));
    await tk.transfer(distributor.address, ether('250'));
    await tk.transfer(staker1, ether('250'));
    await tk.transfer(staker2, ether('250'));
    await tf.addStake(smartConAdd, stakeTokens, {from: staker1});
    await tf.addStake(smartConAdd, stakeTokens, {from: staker2});
    maxVotingTime = await cd.maxVotingTime();
    await tc.lock(CLA, tokens, validity, {
      from: member1
    });
    await tc.lock(CLA, tokens, validity, {
      from: member2
    });
    await tc.lock(CLA, tokens, validity, {
      from: member3
    });
  }


  describe('ETH cover with rejected claim', function () {
    let firstTokenId;
    let minTime;
    let claimId;

    before(setup);
    before(initMembers);

    it('allows buying cover using ETH', async function () {
      const { qt, distributor } =  this;
      coverDetails[4] = '7972408607001';
      var vrsdata = await getQuoteValues(
        coverDetails,
        toHex('ETH'),
        coverPeriod,
        smartConAdd,
        qt.address
      );

      const buyCoverResponse1 = await distributor.buyCover(
        smartConAdd,
        toHex('ETH'),
        coverDetails,
        coverPeriod,
        vrsdata[0],
        vrsdata[1],
        vrsdata[2],
        {from: nftCoverHolder1, value: buyCoverValue.toString()}
      );

      firstTokenId = getCoverDataFromBuyCoverLogs(buyCoverResponse1.logs)
        .tokenId;
    });

    it('allows buying a second cover after buying 1 already', async function () {
      const { qt, distributor } =  this;
      coverDetails[4] = '7972408607002';
      vrsdata = await getQuoteValues(
        coverDetails,
        toHex('ETH'),
        coverPeriod,
        smartConAdd,
        qt.address
      );

      await distributor.buyCover(
        smartConAdd,
        toHex('ETH'),
        coverDetails,
        coverPeriod,
        vrsdata[0],
        vrsdata[1],
        vrsdata[2],
        {from: nftCoverHolder1, value: buyCoverValue.toString()}
      );
    });

    it('allows submitting a claim for the cover', async function () {
      const { distributor, cd } =  this;
      await distributor.submitClaim(firstTokenId, {
        from: nftCoverHolder1
      });

      const minVotingTime = await cd.minVotingTime();
      const now = await time.latest();
      minTime = new BN(minVotingTime.toString()).add(new BN(now.toString()));
      claimId = (await cd.actualClaimLength()) - 1;
    });

    it('fails to submit another claim once a claim is currently in progress for a token', async function () {
      const { distributor } =  this;
      await expectRevert(
        distributor.submitClaim(firstTokenId, {
          from: nftCoverHolder1
        }), "Can submit another claim only if the previous one was denied.");
    });

    it('should return token data for token with claim in progress', async function () {
      const { distributor } =  this;
      const tokenData = await distributor.tokens.call(firstTokenId);

      tokenData.coverId.toString().should.be.equal('1');
      tokenData.claimInProgress.should.be.equal(true);

      tokenData.coverAmount
        .toString()
        .should.be.equal(coverDetails[0].toString());
      tokenData.coverPrice
        .toString()
        .should.be.equal(coverDetails[1].toString());
      tokenData.coverPriceNXM
        .toString()
        .should.be.equal(coverDetails[2].toString());
      tokenData.expireTime
        .toString()
        .should.be.equal(coverDetails[3].toString());
      tokenData.claimId.toString().should.be.equal(claimId.toString());
    });

    it('should allow voting rejection', async function() {
      const { cl, cd, pd, p1, td } =  this;
      (await cl.checkVoteClosing(claimId))
        .toString()
        .should.be.equal((0).toString());

      let initialCAVoteTokens = await cd.getCaClaimVotesToken(claimId);
      await cl.submitCAVote(claimId, -1, {from: member1});
      await cl.submitCAVote(claimId, -1, {from: member2});
      await cl.submitCAVote(claimId, -1, {from: member3});
      let finalCAVoteTokens = await cd.getCaClaimVotesToken(claimId);
      (finalCAVoteTokens[1] - initialCAVoteTokens[1]).should.be.equal(
        tokens * 3
      );
      let all_votes = await cd.getAllVotesForClaim(claimId);
      expectedVotes = all_votes[1].length;
      expectedVotes.should.be.equal(3);
      let isBooked = await td.isCATokensBooked(member1);
      isBooked.should.be.equal(true);

      await time.increaseTo(
        new BN(minTime.toString()).add(new BN((2).toString()))
      );
      (await cl.checkVoteClosing(claimId))
        .toString()
        .should.be.equal((1).toString());

      const apiCallId = (await pd.getApilCallLength()) - 1;
      APIID = await pd.allAPIcall(apiCallId);
      await p1.__callback(APIID, '');
      const newCStatus = await cd.getClaimStatusNumber(claimId);
      newCStatus[1].toString().should.be.equal((6).toString());

      (await cl.checkVoteClosing(claimId))
        .toString()
        .should.be.equal((-1).toString());
    });

    it('cover holder should not be able to redeemClaim', async function() {
      const { distributor } = this;
      await expectRevert(
        distributor.redeemClaim(firstTokenId, {
          from: nftCoverHolder1
        }), "Claim is not accepted"
      );
    });

    it('distributor owner should be able to withdraw ETH fee from all bought covers', async function() {
      const { distributor } = this;
      const feeReceiverBalancePreWithdrawal = new web3.utils.BN(
        await web3.eth.getBalance(distributorFeeReceiver)
      );

      // 2 covers were bought
      const withdrawnSum = buyCoverFee.mul(new web3.utils.BN(2)).toString();
      const r = await distributor.withdrawEther(
        distributorFeeReceiver,
        withdrawnSum,
        {
          from: coverHolder
        }
      );

      const feeReceiverBalancePostWithdrawal = new web3.utils.BN(
        await web3.eth.getBalance(distributorFeeReceiver)
      );
      const gain = feeReceiverBalancePostWithdrawal.sub(
        feeReceiverBalancePreWithdrawal
      );
      gain.toString().should.be.equal(withdrawnSum);
    });

    it('should be able to sell NXM tokens for ETH', async function() {
      const { distributor, mcr } = this;
      const maxSellTokens = await mcr.getMaxSellTokens();
      const sellAmount = maxSellTokens;
      const withdrawableETHPreSale = await distributor.withdrawableTokens.call(
        toHex('ETH')
      );
      const balancePreSale = await web3.eth.getBalance(distributor.address);
      await distributor.sellNXMTokens(sellAmount, {
        from: coverHolder
      });
      const withdrawableETHPostSale = await distributor.withdrawableTokens.call(
        toHex('ETH')
      );
      const balancePostSale = await web3.eth.getBalance(distributor.address);

      const balanceGain = new web3.utils.BN(balancePostSale).sub(
        new web3.utils.BN(balancePreSale)
      );
      const withdrawableGain = withdrawableETHPostSale.sub(
        withdrawableETHPreSale
      );
      withdrawableGain.toString().should.be.equal(balanceGain.toString());
    });
  });


  describe('ETH cover with accepted claim', function () {
    before(setup);
    before(initMembers);

    let firstTokenId
    let claimId
    let minTime
    before(async function() {
      const { qt, distributor, cd } =  this;
      coverDetails[4] = '7972408607001';
      var vrsdata = await getQuoteValues(
        coverDetails,
        toHex('ETH'),
        coverPeriod,
        smartConAdd,
        qt.address
      );

      const buyCoverResponse1 = await distributor.buyCover(
        smartConAdd,
        toHex('ETH'),
        coverDetails,
        coverPeriod,
        vrsdata[0],
        vrsdata[1],
        vrsdata[2],
        {from: nftCoverHolder1, value: buyCoverValue.toString()}
      );

      firstTokenId = getCoverDataFromBuyCoverLogs(buyCoverResponse1.logs)
        .tokenId;

      await distributor.submitClaim(firstTokenId, {
        from: nftCoverHolder1
      });

      const minVotingTime = await cd.minVotingTime();
      const now = await time.latest();
      minTime = new BN(minVotingTime.toString()).add(new BN(now.toString()));
      claimId = (await cd.actualClaimLength()) - 1;
    });

    it('should allow approval voting for submitted claim', async function() {
      const { cl, pd, cd, p1, mcr } =  this;
      await cl.submitCAVote(claimId, 1, {from: member1});
      await cl.submitCAVote(claimId, 1, {from: member2});
      await cl.submitCAVote(claimId, 1, {from: member3});
      await cd.getVoteToken(claimId, 0, 1);
      await cd.getVoteVoter(claimId, 1, 1);
      let verdict = await cd.getVoteVerdict(claimId, 1, 1);
      parseFloat(verdict).should.be.equal(1);

      const now = await time.latest();
      const maxVotingTime = await cd.maxVotingTime();
      closingTime = new BN(maxVotingTime.toString()).add(
        new BN(now.toString())
      );
      await time.increaseTo(
        new BN(closingTime.toString()).add(new BN('6'))
      );

      const apiCallLength = (await pd.getApilCallLength()) - 1;
      let apiid = await pd.allAPIcall(apiCallLength);

      priceinEther = await mcr.calculateTokenPrice(CA_ETH);
      await p1.__callback(apiid, '');
      const newCStatus = await cd.getClaimStatusNumber(claimId);
      newCStatus[1].toString().should.be.equal((7).toString());
      const claimData = await cl.getClaimbyIndex(claimId);

      claimData.finalVerdict.toString().should.be.equal('1');
      claimData.status.toString().should.be.equal('7');

      (await cl.checkVoteClosing(claimId))
        .toString()
        .should.be.equal((-1).toString());
    });

    it('token owner should be able to redeem claim', async function() {
      const { distributor } = this;
      const balancePreRedeem = new web3.utils.BN(
        await web3.eth.getBalance(nftCoverHolder1)
      );
      const redeemClaimsResponse = await distributor.redeemClaim(
        firstTokenId,
        {
          from: nftCoverHolder1
        }
      );
      const logs = Array.from(redeemClaimsResponse.logs);
      const claimRedeemedEvent = logs.filter(
        log => log.event === 'ClaimRedeemed'
      )[0];

      const expectedTotalClaimValue = new web3.utils.BN(coverDetails[0]);

      claimRedeemedEvent.args.receiver.should.be.equal(nftCoverHolder1);
      claimRedeemedEvent.args.value
        .toString()
        .should.be.equal(expectedTotalClaimValue.toString());

      const balancePostRedeem = new web3.utils.BN(
        await web3.eth.getBalance(nftCoverHolder1)
      );

      const tx = await web3.eth.getTransaction(redeemClaimsResponse.tx);
      const gasCost = new web3.utils.BN(tx.gasPrice).mul(
        new web3.utils.BN(redeemClaimsResponse.receipt.gasUsed)
      );
      const balanceGain = balancePostRedeem
        .add(gasCost)
        .sub(balancePreRedeem);

      balanceGain
        .toString()
        .should.be.equal(expectedTotalClaimValue.toString());
    });
  });


  describe('DAI cover with accepted claim', function () {
    before(setup);
    before(initMembers);

    let firstTokenId;

    before(async function() {
      const { dai } = this;
      await dai.transfer(nftCoverHolder1, toWei('2000'));
    })


    it('allows buying cover with DAI', async function () {
      const { dai, distributor, qt } = this;
      await dai.approve(distributor.address, buyCoverDaiValue, {
        from: nftCoverHolder1
      });
      coverDetailsDai[4] = '7972408607006';
      var vrsdata = await getQuoteValues(
        coverDetailsDai,
        hex('DAI'),
        coverPeriod,
        smartConAdd,
        qt.address
      );

      const buyCoverUsingDAIResponse = await distributor.buyCover(
        smartConAdd,
        hex('DAI'),
        coverDetailsDai,
        coverPeriod,
        vrsdata[0],
        vrsdata[1],
        vrsdata[2],
        {from: nftCoverHolder1}
      );

      firstTokenId = getCoverDataFromBuyCoverLogs(
        buyCoverUsingDAIResponse.logs
      ).tokenId;

    });

    it('allows submitting a claim for the cover', async function () {
      const { cd, distributor, cl } = this;
      await distributor.submitClaim(firstTokenId, {
        from: nftCoverHolder1
      });

      const minVotingTime = await cd.minVotingTime();
      const now = await time.latest();
      minTime = new BN(minVotingTime.toString()).add(new BN(now.toString()));
      claimId = (await cd.actualClaimLength()) - 1;
    });


    it('should allow approval voting', async function () {
      const { cd, cl, pd, mcr, p1, dai } = this;
      (await cl.checkVoteClosing(claimId))
        .toString()
        .should.be.equal((0).toString());

      await cl.submitCAVote(claimId, 1, {from: member1});
      await cl.submitCAVote(claimId, 1, {from: member2});
      await cl.submitCAVote(claimId, 1, {from: member3});
      await cd.getVoteToken(claimId, 0, 1);
      await cd.getVoteVoter(claimId, 1, 1);
      let verdict = await cd.getVoteVerdict(claimId, 1, 1);
      parseFloat(verdict).should.be.equal(1);

      const now = await time.latest();
      const maxVotingTime = await cd.maxVotingTime();
      closingTime = new BN(maxVotingTime.toString()).add(
        new BN(now.toString())
      );
      await time.increaseTo(
        new BN(closingTime.toString()).add(new BN('6'))
      );

      // change claim status
      let apiid = await pd.allAPIcall((await pd.getApilCallLength()) - 1);
      priceinEther = await mcr.calculateTokenPrice(CA_ETH);
      await p1.__callback(apiid, '');
      const newCStatus = await cd.getClaimStatusNumber(claimId);
      newCStatus[1].toString().should.be.equal('12');

      // trigger payout
      let apiid2 = await pd.allAPIcall((await pd.getApilCallLength()) - 1);
      priceinEther = await mcr.calculateTokenPrice(CA_ETH);
      await dai.transfer(p1.address, toWei('20'));
      await p1.__callback(apiid2, '');
      const newCStatus2 = await cd.getClaimStatusNumber(claimId);
      newCStatus2[1].toString().should.be.equal('14');

      (await cl.checkVoteClosing(claimId))
        .toString()
        .should.be.equal('-1');
    });


    it('should be able to withdraw DAI fee from all bought covers', async function() {
      const { distributor, dai } = this;

      const feeReceiverBalancePreWithdrawal = new web3.utils.BN(
        await dai.balanceOf(distributorFeeReceiver)
      );

      const daiWithdrawableBalanceBefore = await distributor.withdrawableTokens.call(
        toHex('DAI')
      );

      // 1 cover were bought
      const withdrawnSum = buyCoverDaiFee.toString();
      const r = await distributor.withdrawTokens(
        distributorFeeReceiver,
        withdrawnSum,
        toHex('DAI'),
        {
          from: coverHolder
        }
      );
      const daiWithdrawableBalanceAfter = await distributor.withdrawableTokens.call(
        toHex('DAI')
      );

      const feeReceiverBalancePostWithdrawal = new web3.utils.BN(
        await dai.balanceOf(distributorFeeReceiver)
      );
      const gain = feeReceiverBalancePostWithdrawal.sub(
        feeReceiverBalancePreWithdrawal
      );

      const withdrawableDiff = daiWithdrawableBalanceBefore.sub(
        daiWithdrawableBalanceAfter
      );
      withdrawableDiff.toString().should.be.equal(withdrawnSum);
      gain.toString().should.be.equal(withdrawnSum);
    });

    it('token owner should be able to redeem claim', async function() {
      const { distributor, dai } = this;

      const balancePreRedeem = new web3.utils.BN(
        await dai.balanceOf(nftCoverHolder1)
      );
      const redeemClaimsResponse = await distributor.redeemClaim(
        firstTokenId,
        {
          from: nftCoverHolder1
        }
      );
      const logs = Array.from(redeemClaimsResponse.logs);
      const claimRedeemedEvent = logs.filter(
        log => log.event === 'ClaimRedeemed'
      )[0];

      const expectedTotalClaimValue = new web3.utils.BN(coverDetailsDai[0]);

      claimRedeemedEvent.args.receiver.should.be.equal(nftCoverHolder1);
      claimRedeemedEvent.args.value
        .toString()
        .should.be.equal(expectedTotalClaimValue.toString());

      const balancePostRedeem = new web3.utils.BN(
        await dai.balanceOf(nftCoverHolder1)
      );

      const balanceGain = balancePostRedeem.sub(balancePreRedeem);

      balanceGain
        .toString()
        .should.be.equal(expectedTotalClaimValue.toString());
    });
  });
});
