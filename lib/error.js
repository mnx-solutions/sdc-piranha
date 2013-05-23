'use strict';

var util = require('util');
var fs = require('fs');
var fp = require('file-pointer');
var jade = require('jade');

var fn = null;

fp.create(process.cwd() + '/site/error.jade', function (err, file) {
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
    res.set('Content-Type', 'text/html');

    var statusCode = (err && err.statusCode) ? err.statusCode : 0;
    switch (statusCode) {
        case 401:
            req.session.destroy();
            res.redirect('/');
            break;

        default:
            if (fn) {
                res.send(500, fn(typeof err === 'string' ? { message: err } : err));
            } else {
                res.send(500);
            }
            break;
    }
};