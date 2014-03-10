'use strict';

var fs = require('fs');

module.exports = function execute(scope, app) {
    var SignupProgress = scope.api('SignupProgress');

    app.get('/currentStep', function (req, res) {
        res.send(req.session.signupStep);
    });

    app.get('/attemptId', function (req, res) {
        res.send(req.session.attemptId);
    });

    app.get('/cancel', function (req, res) {
        req.log.info('User cancelled signup process at ' + SignupProgress.getCurrentStep(req) + ' step');
        res.redirect('/landing/forgetToken');
    });
};