'use strict';

module.exports = function execute(scope) {
    var smartCloud = scope.get('smartCloud');

    return function mainAuth(req, res, next) {
        if (!req.session.token) {
            // token missing, don't allow the request

            res.send(401);
            return;
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