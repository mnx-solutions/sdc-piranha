'use strict';
var config = require('easy-config');

if (!config.features || config.features.cdn !== 'disabled') {
    module.exports = {};
}