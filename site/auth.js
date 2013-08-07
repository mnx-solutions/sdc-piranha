'use strict';

module.exports = function execute(scope) {
    return function (req, res, next) {
        var smartCloud = scope.get('smartCloud');

        if (!req.session.token) {
            // token missing, don't allow the request

            res.send(401);
            return;
        }

        if (req.session.userId && req.session.userName) {
            req.log = req.log.child({
                userName: req.session.userName,
                userId: req.session.userId,
                userIp: req.headers['x-cluster-client-ip'] || req.headers['x-forwarded-for']
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