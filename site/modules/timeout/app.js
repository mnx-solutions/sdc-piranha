'use strict';

module.exports = function (scope, app) {
    app.get('/check', function (req, res, next) {
        res.send(200);
    });
};