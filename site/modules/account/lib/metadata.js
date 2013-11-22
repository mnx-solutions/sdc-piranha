'use strict';

var config = require('easy-config');

var metadataObj = (!config.capishim || config.capishim.noUpdate) ? require('./metadata-redis') : require('./metadata-shim');
metadataObj.PHONE_VERIFICATION = 'phoneVerification';
metadataObj.RISK_SCORE = 'riskScore';
metadataObj.SIGNUP_STEP = 'signupStep';
metadataObj.BLOCK_REASON = 'blockingReason';
metadataObj.PORTAL_PRIVATE_KEY = 'portal_private_key';
metadataObj.PORTAL_FINGERPRINT = 'portal_fingerprint';

module.exports = metadataObj;