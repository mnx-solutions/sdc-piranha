'use strict';
var config = require('easy-config');
var additionalDatacenters = {};
if (config.features.sdcDocker === 'enabled' && config.sdcDocker.fullDataCenter) {
    additionalDatacenters[config.sdcDocker.datacenter] = 'https://' + config.sdcDocker.datacenter + '.api.joyentcloud.com';
}
var SmartCloudLib = require('../lib/smartcloud');
var smartCloud;

module.exports = function mainAuthMiddleware(req, res, next) {
    //req.log.info({url: req.url, locals: res.locals.js}, 'Entering auth middleware');
    if (!req.session.token) {
        // token missing, don't allow the request
        res.sendStatus(401);
        return;
    }

    // Proper user ip taking reverse proxy / load balancer into account
    var headerClientIpKey = config.server.headerClientIpKey;
    if (headerClientIpKey) {
        req.userIp = req.header(headerClientIpKey);
    }

    req.userIp = req.userIp || req.ip;

    // Store user session information in log entries
    if (req.session.userId && req.session.userName) {
        if (req.session.parentAccount) {
            req.log = req.log.child({
                userName: req.session.parentAccount,
                userId: req.session.parentAccountId,
                subuserName: req.session.userName,
                subuserId: req.session.userId
            });
        } else {
            req.log = req.log.child({
                userName: req.session.userName,
                userId: req.session.userId
            });
        }
        req.log = req.log.child({
            userIp: req.userIp
        });
    }

    // we have a token, create a new cloudapi object with this
    if (!req.cloud) {
        smartCloud = smartCloud || new SmartCloudLib({
            log: req.log,
            api: config.cloudapi
        });
        smartCloud.cloud({token: req.session.token,
            userId: req.session.userId,
            additionalDatacenters: additionalDatacenters
        }, function (err, cloud) {
            // Ignore authorization error for sub-user
            if (err && req.session.subId) {
                req.cloud = cloud;
                next();
                return;
            }
            if (err) {
                next(err);
                return;
            }
            req.cloud = cloud;
            next();
        });
    } else {
        next();
    }
};
