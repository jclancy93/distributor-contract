const fetch = require('node-fetch');
const { artifacts, web3 } = require('hardhat');
const { ether } = require('@openzeppelin/test-helpers');
const { hex } = require('../test/utils/helpers');
const BN = web3.utils.BN;

const Distributor = artifacts.require('Distributor');
const NXMToken = artifacts.require('NXMToken');
const NXMaster = artifacts.require('NXMaster');
const TokenController = artifacts.require('TokenController');

async function run () {

  const DISTRIBUTOR_ADDRESS = process.env.DISTRIBUTOR_ADDRESS;
  const API_REQUEST_ORIGIN = process.env.API_REQUEST_ORIGIN;
  const ACCOUNT_KEY = process.env.ACCOUNT_KEY;
  console.log({
    DISTRIBUTOR_ADDRESS,
    API_REQUEST_ORIGIN,
  });

  const headers = {
    Origin: API_REQUEST_ORIGIN
  };

  // Setup your cover data.
  const coverData = {
    coverAmount: '1', // ETH in units not wei
    currency: 'ETH',
    asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // stands for ETH
    period: '111', // days
    contractAddress: '0xC57D000000000000000000000000000000000002' // the contract you will be buying cover for
  }

  // URL to request a quote for.
  const quoteURL = `https://api.staging.nexusmutual.io/legacy/v1/quote?`
    + `coverAmount=${coverData.coverAmount}&currency=${coverData.currency}&period=${coverData.period}&contractAddress=${coverData.contractAddress}`;

  console.log(quoteURL);

  const quote = await fetch(quoteURL, { headers }).then(r => r.json());
  console.log(quote);

  // encode the signature result in the data field
  const data = web3.eth.abi.encodeParameters(
    ['uint', 'uint', 'uint', 'uint', 'uint8', 'bytes32', 'bytes32'],
    [quote.price, quote.priceInNXM, quote.expiresAt, quote.generatedAt, quote.v, quote.r, quote.s],
  );

  const distributor = await Distributor.at(DISTRIBUTOR_ADDRESS);

  // add the fee on top of the base price
  const feePercentage = await distributor.feePercentage();
  const basePrice = new BN(quote.price);
  const priceWithFee = basePrice.mul(feePercentage).divn(10000).add(basePrice);

  // quote-api signed quotes are cover type = 0; only one cover type is supported at this point.
  const COVER_TYPE = 0;

  const amountInWei = ether(coverData.coverAmount.toString());

  console.log('approve NXM...');
  const master = await NXMaster.at(await distributor.master());
  const tokenController = await TokenController.at(await master.getLatestAddress(hex('TC')));

  // needs to be done only once! necessary for receiving the locked NXM deposit.
  await distributor.approveNXM(tokenController.address, ether('100000'));

  console.log({
    feePercentage: feePercentage.toString(),
    priceWithFee: priceWithFee.toString(),
    amountInWei: amountInWei.toString(),
    COVER_TYPE
  });

  // execute the buy cover operation on behalf of the user.
  await distributor.buyCover(
    coverData.contractAddress,
    coverData.asset,
    amountInWei,
    coverData.period,
    COVER_TYPE,
    data, {
      value: priceWithFee,
    });

  console.log('Bought cover successfully.');
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('An unexpected error encountered:', error);
    process.exit(1);
  });
