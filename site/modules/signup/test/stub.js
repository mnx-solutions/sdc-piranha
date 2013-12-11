var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');

backend
    .stub(null)
    .request('GET', '/signup/maxmind/call/', backend.data('maxmind'))
    .request('GET', '/signup/maxmind/verify/', backend.data('maxmind-verify'))
    .call('getAccount', backend.data('account-empty'));