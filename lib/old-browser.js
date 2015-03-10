'use strict';

var util = require('util');
var fs = require('fs');
var fp = require('file-pointer');
var jade = require('jade');

var fn = null;

fp.define(process.cwd() + '/site/old-browser.jade', function (err, file) {
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

module.exports = function (req, res, next) {
    var currentYear = new Date().getFullYear();
    res.set('Content-Type', 'text/html');
    res.send(200, fn({currentYear: currentYear}));
};
