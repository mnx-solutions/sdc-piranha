'use strict';

var util = require('util');
var fs = require('fs');
var fp = require('file-pointer');
var jade = require('jade');

var fn = null;

fp.define(process.cwd() + '/site/error.jade', function (err, file) {
    if (!err) {
        file.__read(function (err, content) {
            fn = jade.compile(content, {});

            file.__listen('change', function() {
                file.__read(function (err, ct) {
                    fn = jade.compile(ct, {});
                });
            });

            file.__startWatch();
        });
    }
});

module.exports = function (err, req, res, next) {
    var currentYear = new Date().getFullYear();
    err.statusCode = (err && err.statusCode) ? err.statusCode : 0;
    switch (err.statusCode) {
        case 401:
            req.session.destroy();
            res.redirect('/');
            break;

        default:
            if (fn) {
                if (typeof err === 'string') {
                    err = {
                        message: err,
                        statusCode: err.statusCode
                    }
                }
                err.currentYear = currentYear;
                res.statusCode = 500;
                res.set('Content-Type', 'text/html')
                    .send(fn(err));
            } else {
                res.sendStatus(500);
            }
            break;
    }
};
