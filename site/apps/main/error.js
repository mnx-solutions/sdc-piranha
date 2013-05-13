'use strict';

var error = require('../../../lib/error');

module.exports = function (err, req, res, next) {
    console.log(err);
    error(err, req, res, next);
};