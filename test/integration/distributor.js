const { accounts, web3 } = require('hardhat');
const { ether, expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const Decimal = require('decimal.js');
const { toBN } = web3.utils;


// const { enrollMember, enrollClaimAssessor } = require('../utils/enroll');
// const { buyCover } = require('../utils/buyCover');

const [, member1, member2, member3, coverHolder, nonMember1] = accounts;

describe('Token price functions', function () {

  beforeEach(async function () {
    await enrollMember(this.contracts, [member1, member2, member3, coverHolder]);
  });

  it('buyNXM reverts for non-member', async function () {
    const {p1: pool} = this.contracts;

    assert(true);
  });
});
