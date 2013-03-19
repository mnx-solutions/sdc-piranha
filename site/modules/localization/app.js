'use strict';

var config = require('easy-config');
var express = require('express');
//var assert = require('assert');

var app = express();

module.exports = function (scope, app, callback) {
    app.get('/locales', function (req, res, next) {
        res.json(config.localization.locales);
    });

    app.get('/translations', function (req, res, next) {
        res.locals.localizer.getLocaleDefinitions(
            res.locals.localizer.getLocale(req),
            function(err, defs) {
                if (err) {
                    res.send(500, { error: err.message });
                    return;
                }

                res.json(defs);
            });
    });

    setImmediate(callback);

};