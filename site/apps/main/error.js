'use strict';

var util = require('util');
var fs = require('fs');
var fp = require('file-pointer');
var jade = require('jade');

var fn = null;

fp.create(__dirname + '/error.jade', function (err, file) {
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

    if (fn) {
        res.send(500, fn(err));
    } else {
        res.send(500);
    }
};