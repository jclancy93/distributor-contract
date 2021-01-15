const { web3 } = require('hardhat');
const { ether } = require('@openzeppelin/test-helpers');
const { toBN } = web3.utils;
const { hex } = require('../utils').helpers;
const setup = require('../../nexusmutual-contracts/test/integration/setup');

const { getBuyCoverDataParameter } = require('../../nexusmutual-contracts/test/integration/Cover/utils');

async function enrollMember ({ mr, tk, tc }, members, options = {}) {

  const { initialTokens = ether('2500') } = options;

  for (const member of members) {
    await mr.payJoiningFee(member, { from: member, value: ether('0.002') });
    await mr.kycVerdict(member, true);
    await tk.approve(tc.address, ether('1000000'), { from: member });
    await tk.transfer(member, toBN(initialTokens));
  }
}

async function enrollClaimAssessor ({ tc }, assessors, options = {}) {

  const {
    lockTokens = ether('2000'),
    validity = 365 * 24 * 60 * 60,
  } = options;

  for (const member of assessors) {
    await tc.lock(hex('CLA'), toBN(lockTokens), toBN(validity), { from: member });
  }
}

const enroll = {
  enrollMember,
  enrollClaimAssessor,
};

module.exports = {
  setup,
  enroll,
  getBuyCoverDataParameter,
};
