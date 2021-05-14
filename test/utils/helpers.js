const assert = require('assert');
const { web3 } = require('hardhat');
const { BN, toBN } = web3.utils;

const hex = string => '0x' + Buffer.from(string).toString('hex');

const parseLogs = tx => {
  return tx.logs.map(log => {
    console.log(log);
    return log;
  });
};

const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEFAULT_FEE_PERCENTAGE = 500; // 5%

function bnEqual (actual, expected, message) {

  const actualBN = toBN(actual);
  const expectedBN = toBN(expected);
  const error = message || `expected ${actualBN.toString()} to equal ${expectedBN.toString()}`;

  if (actualBN.eq(expectedBN)) {
    return;
  }

  throw new assert.AssertionError({
    message: error,
    actual: actualBN.toString(),
    expected: expectedBN.toString(),
    operator: 'bnEqual',
  });
}

module.exports = {
  hex,
  parseLogs,
  ETH,
  ZERO_ADDRESS,
  DEFAULT_FEE_PERCENTAGE,
  bnEqual,
};
