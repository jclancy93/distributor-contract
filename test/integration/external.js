const { web3 } = require('hardhat');
const { ether } = require('@openzeppelin/test-helpers');
const { toBN } = web3.utils;
const { hex } = require('../utils').helpers;
const setup = require('../../nexusmutual-contracts/test/integration/setup');
const { enrollClaimAssessor, enrollMember } = require('../../nexusmutual-contracts/test/integration/utils/enroll')
const { getBuyCoverDataParameter } = require('../../nexusmutual-contracts/test/integration/Cover/utils');

const ClaimStatus = {
  IN_PROGRESS: '0',
  ACCEPTED: '1',
  REJECTED: '2'
}

const enroll = {
  enrollMember,
  enrollClaimAssessor,
};

module.exports = {
  setup,
  enroll,
  getBuyCoverDataParameter,
  ClaimStatus
};
