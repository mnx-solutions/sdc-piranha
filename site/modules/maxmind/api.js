'use strict';

var restify = require('restify');
var config = require('easy-config');

if (!config.maxmind || !config.maxmind.licenseId) {
    throw new Error('MaxMind licenseId must be defined in the config');
}

var riskTiers = config.maxmind.riskTiers || {
    'tier-1': 33,
    'tier-2': 66,
    'tier-3': 100
};

var fraudVerificationClient = restify.createStringClient({url: config.maxmind.fraudApiUrl});

module.exports = function execute(scope, register) {
    var api = {};

    //FIXME: Uncomment and remove old function - faster + readibility
//    function checkBlackList(data) {
//        var blacklist = config.ns.blacklist;
//        if(!blacklist) {
//            return true;
//        }
//        var comparison = {
//            domain: data.domain.toLowerCase(),
//            ip: data.i,
//            country: data.country
//        };
//
//        return !['domain', 'ip', 'country'].some(function (el) {
//            if(Array.isArray(blacklist[el]) && blacklist[el].indexOf(comparison[el]) !== -1) {
//                return true;
//            }
//        });
//    }

    function checkBlackList(data) {
        var blacklistConfig = config.ns.blacklist || {};
        blacklistConfig.domain = blacklistConfig.domain || [];
        blacklistConfig.ip = blacklistConfig.ip || [];
        blacklistConfig.country = blacklistConfig.country || [];

        if (blacklistConfig.domain.indexOf(data.domain.toLowerCase()) !== -1) {
            return false;
        }
        if (blacklistConfig.ip.indexOf(data.i) !== -1) {
            return false;
        }
        if (blacklistConfig.country.indexOf(data.country) !== -1) {
            return false;
        }
        return true;
    }


    function calcRiskTierCeil(riskScore) {
        var i = 1;
        var tier = 'tier-1';
        while(riskTiers[tier]) {
            if(riskScore <= riskTiers[tier]) {
                return riskTiers[tier];
            }
            i++;
            tier = 'tier-' + i;
        }
        return 100; //return max
    }

    //FIXME: Remove in favour of the calcRiskTierCeil
    function calcRiskTier(riskScore) {
        var calculatedTier = null;
        var calculatedTierLimit = 100;
        for (var i in riskTiers) {
            var limitScore = riskTiers[i];
            if (riskScore <= limitScore && limitScore <= calculatedTierLimit) {
                calculatedTier = i;
                calculatedTierLimit = limitScore;
            }
        }
        return calculatedTier;
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
            i: config.maxmind.tmpClientIp || call.req.ip // config option for testing
        };

        call.log.info('Calling minFraud verification', query);
        var result = {};
        if (!checkBlackList(query)) {
            call.log.warn('User matched against black list and was blocked');
            callback(new Error('User matched against black list and was blocked'), {});
            return;
        }
        fraudVerificationClient.get({path: '/app/ccv2r', query: query}, function (err, creq, cres, data) {
            if (err) {
                call.log.warn('minFraud was not available, thus user verified', {userId: call.session.userId});
                callback(null, {});
                return;
            }
            data.split(';').forEach(function (fieldStr) {
                var keyValueArr = fieldStr.split('=');
                //FIXME: We do not use IF sentences without braces!
                if (keyValueArr.length > 1) result[keyValueArr[0]] = keyValueArr[1];
            });

            // risk score override for testing
            result.riskScore = config.maxmind.tmpRiskScore || result.riskScore;

            call.log.info('minFraud riskScore received (riskScore - probability of fraud in percent)',
                {riskScore: result.riskScore, explanation: result.explanation});

            //FIXME: What is this? There is no res object here. + Unreachable
            if (err) {
                res.json(err);
                return;
            }

            var riskErr = calcRiskTierCeil(result.riskScore) === 100 ? 'User was blocked due to high risk score' : null;
            callback(riskErr, result);
        });
    };

    register('MaxMind', api);
};