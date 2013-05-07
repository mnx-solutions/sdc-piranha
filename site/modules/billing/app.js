'use strict';

var zuora = require('zuora');

module.exports = function (scope, app, callback) {
    app.get('/countries', function (req, res, next) {
        res.json(zuora.countries);
    });
    app.get('/states', function (req, res, next) {
        res.json(zuora.states);
    });
    setImmediate(callback);
};