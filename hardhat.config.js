require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');

const { task } = require('hardhat/config');
const ether = n => `${n}${'0'.repeat(18)}`;

task('test', async (_, hre, runSuper) => {
  hre.accounts = await hre.web3.eth.getAccounts();
  const testFiles = _.testFiles.length ? _.testFiles : ['./test/index.js'];
  await runSuper({ testFiles });
});

task('typechain', async (_, { config }) => {

  const { tsGenerator } = require('ts-generator');
  const { TypeChain } = require('typechain/dist/TypeChain');

  const cwd = process.cwd();
  const rawConfig = {
    files: `${config.paths.artifacts}/!(build-info|hardhat)/**/+([a-zA-Z0-9]).json`,
    outDir: 'types',
    target: 'truffle-v5',
  };

  await tsGenerator({ cwd }, new TypeChain({ cwd, rawConfig }));
});

const forkURL = process.env.TEST_ENV_FORK;
const forkConfig = forkURL ? { forking: { url: forkURL } } : {};

module.exports = {

  mocha: {
    exit: true,
    bail: true,
    recursive: false,
  },

  networks: {
    hardhat: {
      accounts: {
        count: 100,
        accountsBalance: ether(10000000),
      },
      allowUnlimitedContractSize: true,
      blockGasLimit: 12e9,
      ...forkConfig,
    },
  },

  solidity: {
    compilers: [
      { version: '0.7.4' } // distributor
    ],
  },
};
