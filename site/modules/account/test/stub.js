var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');

backend
    .stub(null)
    .request('POST', 'account/ssh/create/', {}, {}, backend.data('ssh-create'))
    .request('GET', 'account/ssh/job/56527cd9-b9fd-4d2e-8edc-50cce0a9d8c9/', {}, {}, backend.data('ssh-create-job'))
    .call('getAccount', backend.data('account'))
    .call('addPaymentMethod', {})
    .call('defaultCreditCard', {})
    .call('updateAccount', {})
    .call('createKey', backend.data('create-key'))
    .call('listKeys', [backend.data('list-keys')]);