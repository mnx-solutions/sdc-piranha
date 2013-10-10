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

        // proper user ip taking reverse proxy / load balancer into account
        if (req.scope.config.server.headerClientIpKey) {
            req.userIp = req.header(req.scope.config.server.headerClientIpKey);
        }

        req.userIp = req.userIp || req.ip;

        if (!req.userIp) {
            req.log.debug('Client IP address is not found in header by configured key \'%s\'', req.scope.config.server.headerClientIpKey);
        }

        // Store user session information in log entries
        if (req.session.userId && req.session.userName) {
            req.log = scope.log.child({
                userName: req.session.userName,
                userId: req.session.userId,
                userIp: req.userIp
            });
        }

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
    };
};