'use strict';

var restify = require('restify');
var config = require('easy-config');

if (!config.maxmind || !config.maxmind.licenseId) {
    throw new Error('MaxMind licenseId must be defined in the config');
}

var riskScoreFraudLimit = config.maxmind.riskScoreFraudLimit || 66;

var fraudVerificationClient = restify.createStringClient({url: config.maxmind.fraudApiUrl});

module.exports = function execute(scope, register) {
    var api = {};

    function checkBlackList(data) {
        var blacklist = config.ns.blacklist;
        if (!blacklist) {
            return true;
        }
        var comparison = {
            domain: data.domain.toLowerCase(),
            ip: data.i,
            country: data.country
        };

        return !['domain', 'ip', 'country'].some(function (el) {
            return Array.isArray(blacklist[el]) && blacklist[el].indexOf(comparison[el]) !== -1;
        });
    }

    api.minFraud = function (call, userInfo, billingInfo, creditCardInfo, callback) {
        var query = {
            country: billingInfo.country,
            postal: billingInfo.zipCode,
            domain: userInfo.email.substring(userInfo.email.indexOf('@') + 1),
            city: billingInfo.city,
            region: billingInfo.state || null,
            bin: creditCardInfo.creditCardNumber.substring(0, 6),
            license_key: config.maxmind.licenseId,
            i: config.maxmind.testClientIp || call.req.userIp // config option for testing
        };

        call.log.info('Calling minFraud verification', query);
        var result = {};
        if (!checkBlackList(query)) {
            call.log.warn('User matched against black list and was blocked');
            setImmediate(function () {
                callback(null, {block: true});
            });
            return;
        }
        fraudVerificationClient.get({path: '/app/ccv2r', query: query}, function (err, creq, cres, data) {
            if (err) {
                call.log.warn('minFraud was not available, thus user verified', {userId: call.req.session.userId});
                callback(null, {block: false});
                return;
            }
            data.split(';').forEach(function (fieldStr) {
                var keyValueArr = fieldStr.split('=');
                if (keyValueArr.length > 1) {
                    result[keyValueArr[0]] = keyValueArr[1];
                }
            });

            // risk score override for testing
            result.riskScore = config.maxmind.testRiskScore || result.riskScore;

            call.log.info('minFraud riskScore received (riskScore - probability of fraud in percent)',
                {riskScore: result.riskScore, explanation: result.explanation});

            result.block = result.riskScore > riskScoreFraudLimit;
            if (result.block) {
                call.log.info('User was blocked due to high risk score', {userId: call.req.session.userId});
            }
            callback(null, result);
        });
    };

    register('MaxMind', api);
};
