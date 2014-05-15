'use strict';
var config = require('easy-config');

if (!config.features || config.features.rbac !== 'disabled') {
    var rbac = {};
    module.exports = rbac;
}