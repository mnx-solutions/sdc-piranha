'use strict';
var config = require('easy-config');
var restify = require('restify');

var limits = function execute(scope) {
    var server = scope.api('Server');
    var Billing = scope.api('Billing');

    server.onCall('BillingUserLimits', function (call) {
        Billing.getUserLimits(call.req.session.userId, function (error, req, res, limits) {
            var errorMessage = null;
            if (error) {
                errorMessage = 'Cannot get user limits. Service Unavailable.';
                call.req.log.error(error, 'Cannot get user limits. Service Unavailable.');
            }
            call.done(errorMessage, limits || []);
        });
    });
};

if (!config.features || config.features.provisioningLimits !== 'disabled') {
    module.exports = limits;
}