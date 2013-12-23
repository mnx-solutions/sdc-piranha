'use strict';

/**
 * toggle "useMoreSecurity" features
 *   - 15 min sessions
 *   - two-factor authentication
 *
 * stores the toggle in capi metadata
 */
var metadata = require('../../account/lib/metadata');

var set = function (customerUuid, secretkey, callback) {
    metadata.set(customerUuid, metadata.TFA_TOGGLE, {secretkey: secretkey}, callback);
};

var get = function (customerUuid, callback) {
    metadata.get(customerUuid, metadata.TFA_TOGGLE, 'secretkey', callback);
};

module.exports = {
    set: set,
    get: get
};