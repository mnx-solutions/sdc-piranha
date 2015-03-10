'use strict';
var config = require('easy-config');

module.exports = function execute(scope) {
    var smartCloud = scope.get('smartCloud');

    return function mainAuth(req, res, next) {
        if (!req.session.token) {
            // token missing, don't allow the request

            res.send(401);
            return;
        }

        // Proper user ip taking reverse proxy / load balancer into account
        var headerClientIpKey = req.scope.config.server.headerClientIpKey;
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
        if(!req.cloud) {
            var _cloud = null;
            Object.defineProperty(req, 'cloud', {
                get: function() {
                    if(!_cloud) {
                        _cloud = smartCloud.cloud({ token: req.session.token, subId: req.session.subId });
                    }
                    return _cloud;
                },
                enumerable: true
            });

            if(smartCloud.needRefresh()) {
                smartCloud.cloud({ token: req.session.token, subId: req.session.subId }, function (err, cloud) {
                    // Ignore authorization error for sub-user
                    if (err && req.session.subId) {
                        _cloud = cloud;
                        next();
                        return;
                    }
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
    };
};