'use strict';
var fs = require('fs');
var path = require('path');
var transform = require('stream').Transform;

var config = require('easy-config');
var bunyan = require('bunyan');
var utils = require('./utils');
var requireIfExists = utils.requireIfExists;
var sync = utils.sync;

function copy(dst, src, exclude) {
    exclude = exclude || [];
    Object.getOwnPropertyNames(src).forEach(function (key) {
        if (exclude.indexOf(key) === -1) {
            dst[key] = src[key];
        }
    });
}

module.exports = function (appPath, options, callback) {
    callback = typeof callback === 'function' ? callback : function () {};

    var appConfig = requireIfExists(appPath, 'package.json'),
        container = {};

    var logger = options.log || bunyan.createLogger({name: 'api'});
    var stream = sync(function (module, done) {
        var api = requireIfExists('site/modules', module, 'api.js');
        if (api) {
            api.init(logger.child({module: module}), config, function () {
                copy(container, api, ['init']);
                done();
            });
        } else {
            done();
        }
    }, function () {
        callback(null, container);
    });
    if (Array.isArray(appConfig.modules)) {
        appConfig.modules.forEach(stream.write.bind(stream));
    }
    stream.end();
    return stream;
};
