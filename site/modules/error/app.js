'use strict';

var express = require('express');

module.exports = function execute(scope, app) {
    var server = scope.api('Server');
    var utils = scope.get('utils');

    app.get('/', function (req, res, next) {
        throw new Error('JAMA SUUR!');
    });
}