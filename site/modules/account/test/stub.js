var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');

backend
    .stub(null)
    .request('POST', 'account/ssh/create/', {}, {}, backend.data('ssh-create'))
    .request('GET', 'account/ssh/job/56527cd9-b9fd-4d2e-8edc-50cce0a9d8c9/', {}, {}, backend.data('ssh-create-job'))
    .request('GET', 'tfa/setup', {}, {}, 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=otpauth://totp/endrik1%40joyent%3Fsecret=JEZGYURUHBEFEVKLKU7GEL2DLAQSUMDH')
    .request('POST', 'tfa/setup', {}, {}, {
        'status':'ok'
    })
    .call('getAccount', backend.data('account'))
    .call('addPaymentMethod', {})
    .call('defaultCreditCard', {})
    .call('updateAccount', backend.data('account-update'))
    .call('createKey', backend.data('create-key'))
    .call('listKeys', [backend.data('list-keys')]);