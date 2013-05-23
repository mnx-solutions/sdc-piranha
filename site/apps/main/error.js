'use strict';

var error = require('../../../lib/error');

module.exports = function (err, req, res, next) {
    error(err, req, res, next);
};