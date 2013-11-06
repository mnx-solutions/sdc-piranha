'use strict';

var zuora = require('zuora');
var config = require('easy-config');
var zuoraHelpers = require('./lib/zuora-helpers');

module.exports = function execute(scope, app) {
    app.get('/countries', function (req, res, next) {
        var data = zuora.countries.getArray(config.zuora.rest.validation.countries);
        data.forEach(function (el) {
            if( [ 'USA','CAN','GBR' ].indexOf(el.iso3) >= 0) {
                el.group = 'Default';
            } else {
                el.group = 'All countries';
            }
        });
        res.json(data);
    });

    app.get('/states', function (req, res, next) {
        res.json(zuora.states);
    });

    app.get('/invoice/:account/:id', zuoraHelpers.getInvoicePDF);
};