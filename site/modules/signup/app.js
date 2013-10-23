'use strict';

var fs = require('fs');
var mustache = require('mustache');

module.exports = function execute(scope, app) {
    app.get('/currentStep', function (req, res) {
        res.send(req.session.signupStep);
    });

    app.get('/attemptId', function(req, res) {
        res.send(req.session.attemptId);
    });
};