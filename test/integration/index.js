const { takeSnapshot, revertToSnapshot, reset } = require('../utils').evm;
const { setup } = require('./external');

describe('INTEGRATION TESTS', function () {

  before(reset);
  before(setup);

  beforeEach(async function () {
    this.snapshotId = await takeSnapshot();


  });

  afterEach(async function () {
    await revertToSnapshot(this.snapshotId);
  });

  require('./distributor');
});
