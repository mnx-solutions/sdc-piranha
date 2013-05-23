'use strict';

var config = require('easy-config');
var SmartCloud = require('../lib/smartcloud');
var bunyan = require('bunyan');

if(!config.cloudapi || !config.cloudapi.keyPath || typeof config.cloudapi.keyPath !== 'string') {
    throw new TypeError('cloudapi configuration (.keyPath) must be defined');
}

var smartCloud = new SmartCloud({
    log: bunyan.createLogger(config.log),
    api: config.cloudapi
});

module.exports = function (req, res, next) {
    if(!req.session.token) {
        // token missing, don't allow the request

        res.send(401);
    } else {
        //return res.redirect('/login');
        // we have a token, create a new cloudapi object with this
        if(!req.cloud) {

            var _cloud = null;
            Object.defineProperty(req, 'cloud', {
                get: function() {
                    if(!_cloud) {
                        _cloud = smartCloud.cloud({ token: req.session.token });
                    }
                    return _cloud;
                },
                enumerable: true
            });

            if(smartCloud.needRefresh()) {
                smartCloud.cloud({token: req.session.token}, function (err, cloud) {
                    if (err) {
                        next(err);
                        return;
                    }
                    _cloud = cloud;
                    next();
                });
            } else {
                next();
            }
        } else {
            next();
        }

    }
};