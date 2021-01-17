const fetch = require('node-fetch');
const { artifacts, web3 } = require('hardhat');
const { ether } = require('@openzeppelin/test-helpers');
const { hex } = require('../test/utils/helpers');

const Distributor = artifacts.require('Distributor');

async function run () {

  const DISTRIBUTOR_ADDRESS = process.env.DISTRIBUTOR_ADDRESS;
  const API_REQUEST_ORIGIN = process.env.API_REQUEST_ORIGIN;
  console.log({
    DISTRIBUTOR_ADDRESS,
    API_REQUEST_ORIGIN
  });

  const headers = {
    Origin: API_REQUEST_ORIGIN
  };

  const coverData = {
    coverAmount: '1', // ETH
    currency: 'ETH',
    asset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    period: '111', // days
    contractAddress: '0xC57D000000000000000000000000000000000002'
  }

  const quoteURL = `https://api.staging.nexusmutual.io/v1/quote?`
    + `coverAmount=${coverData.coverAmount}&currency=${coverData.currency}&period=${coverData.period}&contractAddress=${coverData.contractAddress}`;

  const quote = await fetch(quoteURL, { headers }).then(r => r.json());
  console.log(quote);

  const data = web3.eth.abi.encodeParameters(
    ['uint', 'uint', 'uint', 'uint', 'uint8', 'bytes32', 'bytes32'],
    [quote.price, quote.priceInNXM, quote.expiresAt, quote.generatedAt, quote.v, quote.r, quote.s],
  );

  const distributor = await Distributor.at(DISTRIBUTOR_ADDRESS);
  const feePercentage = await distributor.feePercentage();
  const basePrice = new BN(quote.price);
  const priceWithFee = basePrice.muln(feePercentage).divn(10000).add(basePrice);

  // quote-api signed quotes are cover type = 0
  const COVER_TYPE = 0;

  const amountInWei = ether(coverData.amount);

  await distributor.buyCover(
    coverData.contractAddress,
    coverData.asset,
    amountInWei,
    coverData.period,
    COVER_TYPE,
    data, {
      value: priceWithFee,
    });
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('An unexpected error encountered:', error);
    process.exit(1);
  });
