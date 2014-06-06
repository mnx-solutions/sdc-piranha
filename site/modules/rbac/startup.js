'use strict';
var config = require('easy-config');

if (!config.features || config.features.rbac !== 'disabled') {
    //FIXME: Startup usually attaches serverTab handlers, no export
    //FIXME: I'd move serverTab handlers from account to this startup as they're only used in RBAC
    var rbac = {};
    module.exports = rbac;
}