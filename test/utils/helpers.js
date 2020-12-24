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

module.exports = {
  hex,
  parseLogs,
  ETH,
  ZERO_ADDRESS,
  DEFAULT_FEE_PERCENTAGE,
};
