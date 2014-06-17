'use strict';
var config = require('easy-config');
var restify = require('restify');

var mdb = function execute(scope) {

};

if (!config.features || config.features.mdb !== 'disabled') {
    module.exports = mdb;
}