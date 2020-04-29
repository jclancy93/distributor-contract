const { contract, accounts, defaultSender, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, ether, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
+require('chai').should();

const Distributor = contract.fromArtifact('Distributor');

const getValue = require('../nexusmutual-contracts/test/utils/getMCRPerThreshold.js').getValue;
const getQuoteValues = require('../nexusmutual-contracts/test/utils/getQuote.js').getQuoteValues;

const setup = require('./utils/setup');


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


const INITIAL_SUPPLY = ether('1500000');
const EXCHANGE_TOKEN = ether('10000');
const EXCHANGE_ETHER = ether('10');
const QE = '0x51042c4d8936a7764d18370a6a0762b860bb8e07';


const CA_ETH = '0x45544800';
const CLA = '0x434c41';
const fee = ether('0.002');
const PID = 0;
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
const claimSubmitDepositPercentage = 5;

const coverBasePrice = new web3.utils.BN(coverDetails[1]);
const buyCoverValue = coverBasePrice
  .mul(new web3.utils.BN(coverPriceMultiplier))
  .div(new web3.utils.BN(percentageDenominator));
const buyCoverFee = buyCoverValue.sub(coverBasePrice);
const submitClaimDeposit = coverBasePrice
  .mul(new web3.utils.BN(claimSubmitDepositPercentage))
  .div(new web3.utils.BN(percentageDenominator));

const coverBaseDaiPrice = new web3.utils.BN(coverDetailsDai[1]);
const buyCoverDaiValue = coverBaseDaiPrice
  .mul(new web3.utils.BN(coverPriceMultiplier))
  .div(new web3.utils.BN(percentageDenominator));
const buyCoverDaiFee = buyCoverDaiValue.sub(coverBaseDaiPrice);
const submitClaimDaiDeposit = coverBaseDaiPrice
  .mul(new web3.utils.BN(claimSubmitDepositPercentage))
  .div(new web3.utils.BN(percentageDenominator));


describe('Distributor', function () {
  this.timeout(10000);
  beforeEach(setup);
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

  const P_18 = new BN(toWei('1').toString());
  const stakeTokens = ether('5');
  const tokens = ether('60');
  const validity = duration.days('30');
  const UNLIMITED_ALLOWANCE = new BN((2).toString())
    .pow(new BN((256).toString()))
    .sub(new BN((1).toString()));
  const BOOK_TIME = new BN(duration.hours('13').toString());
  let coverID;
  let closingTime;
  let minTime;
  let maxVotingTime;
  let claimId;

  beforeEach(async function () {
    const { mr, mcr, pd, tk, tf, cd, tc, qt, master } = this;

    console.log('init stakers');
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
    (await pd.capReached()).toString().should.be.equal((1).toString());

    // const payJoiningFees = [member1, member2, member3, staker1, staker2, coverHolder, coverHolder].map(async (member) => {
    //   await mr.payJoiningFee(member, {from: member, value: fee});
    //   await mr.kycVerdict(member, true);
    // });
    //
    // await Promise.all(payJoiningFees);

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

    await Promise.all([
      tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member1}),
      tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member2}),
      tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: member3}),
      tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker1}),
      tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: staker2}),
      tk.approve(tc.address, UNLIMITED_ALLOWANCE, {from: coverHolder}),
      distributor.nxmTokenApprove(tc.address, UNLIMITED_ALLOWANCE, {
        from: coverHolder
      })
    ])

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
  })


  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });

  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
  it('allows buying cover using ETH', async function () {
    const { qt, master, distributor } =  this;
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
  });
});
