'use strict';

module.exports = function (scope, callback) {

    var middleware = function (req, res, next) {



        return next();
    };

    setImmediate(function () {
        callback(null, {
            index: [
                middleware
            ]
        });
    });
};