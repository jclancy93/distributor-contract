require('dotenv').config();
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-etherscan');

const { task } = require('hardhat/config');
const ether = (n) => `${n}${'0'.repeat(18)}`;

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

const networks = {
  hardhat: {
    accounts: {
      count: 100,
      accountsBalance: ether(10000000),
    },
    allowUnlimitedContractSize: true,
    blockGasLimit: 12e9,
    ...forkConfig,
  },
};

for (const network of ['MAINNET', 'KOVAN']) {
  const url = process.env[`${network}_PROVIDER_URL`];
  const accounts = [process.env[`${network}_ACCOUNT_KEY`]];
  networks[network.toLowerCase()] = { accounts, url };
}

const compilerSettings = process.env.ENABLE_OPTIMIZER
  ? { optimizer: { enabled: true, runs: 200 } }
  : {};

module.exports = {
  mocha: {
    exit: true,
    bail: true,
    recursive: false,
  },

  networks,

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },

  solidity: {
    compilers: [
      { version: '0.7.4' }, // distributor
      { version: '0.5.17' }, // nexus mutual
      { version: '0.5.7' }, // nexus mutual governance
      { version: '0.5.16' }, // uniswap v2 core
      { version: '0.6.6' }, // uniswap v2 peripherals,
      { settings: compilerSettings, version: '0.8.4' }, // swap operator
    ].map((compiler) => ({ ...compiler, settings: compilerSettings })),
  },
};
