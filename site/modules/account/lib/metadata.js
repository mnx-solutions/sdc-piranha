'use strict';

var config = require('easy-config');

module.exports = (config.capishim && config.capishim.noUpdate) ? require('./metadata-redis') : require('./metadata-shim');