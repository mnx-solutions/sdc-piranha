'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var SignupProgress = scope.api('SignupProgress');

    server.onCall('setSignupStep', function (call) {
        // get account using cloudapi
        console.log(call.data.id, call.data.step);
        SignupProgress.setTokenVal(call.data.id, call.data.step, call.done.bind(call));
    });

    server.onCall('getSignupStep', function (call) {
        // get account using cloudapi
        SignupProgress.getTokenVal(call.data.id, function (err, val) {
            if(err) {
                call.done(err);
                return;
            }
            if(!val) {
                val = 'start';
            }
            call.done(null, val);
        });
    });
};