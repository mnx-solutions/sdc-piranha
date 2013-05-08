'use strict';

var zuora = require('zuora');
var config = require('easy-config');

module.exports = function (scope, app, callback) {
    app.get('/countries', function (req, res, next) {
        res.json(zuora.countries.getArray(config.zuora.api.validation.countries));
    });
    app.get('/states', function (req, res, next) {
        res.json(zuora.states);
    });
    setImmediate(callback);
};