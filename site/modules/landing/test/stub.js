var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');

backend
    .stub(null)
    .request('GET', 'cloudAnalytics/ca', {}, {}, new Error())
    .request('GET', 'cloudAnalytics/ca/help', {}, {}, new Error());