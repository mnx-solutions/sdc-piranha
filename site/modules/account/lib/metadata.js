'use strict';

var config = require('easy-config');

var metadataObj = (!config.capishim || config.capishim.noUpdate) ? require('./metadata-redis') : require('./metadata-shim');
metadataObj.PHONE_VERIFICATION = 'phoneVerification';
metadataObj.RISK_SCORE = 'riskScore';
metadataObj.SIGNUP_STEP = 'signupStep';
metadataObj.BLOCK_REASON = 'blockingReason';

module.exports = metadataObj;