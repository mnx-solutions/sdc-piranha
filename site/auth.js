'use strict';

var config = require('easy-config');
var Cloud = require('../lib/cloud');
var bunyan = require('bunyan');

module.exports = function (req, res, next) {

    if(!req.session.token) {
        // token missing, don't allow the request
        res.send(401);
    } else {
        //return res.redirect('/login');
        // we have a token, create a new cloudapi object to the session with this
        if(!req.cloud) {

            var log = bunyan.createLogger(config.log);

            Cloud.init({
                log: log,
                token: req.session.token,
                api: config.cloudapi
            }, function (err, cloud) {
                if (err) {
                    log.error(err);
                    return;
                }

                // save cloud into the session
                req.cloud = cloud;

                return next();
            });

        } else {
            return next();
        }

    }
};