'use strict';

var config = require('easy-config');

var metadataObj = (!config.capishim || config.capishim.noUpdate) ? require('./metadata-redis') : require('./metadata-shim');
metadataObj.PHONE_VERIFICATION = 'phoneVerification';
metadataObj.RISK_SCORE = 'riskScore';
metadataObj.RISK_SCORE_EXPLANATION = 'riskScoreExplanation';
metadataObj.SIGNUP_STEP = 'signupStep';
metadataObj.BLOCK_REASON = 'blockingReason';
metadataObj.PORTAL_PRIVATE_KEY = 'portal_private_key';
metadataObj.PORTAL_FINGERPRINT = 'portal_fingerprint';
metadataObj.ACCOUNT_HISTORY = 'accountHistory';
metadataObj.TFA_TOGGLE = 'useMoreSecurity';
metadataObj.FIRST_INSTANCE = 'firstInstance';

module.exports = metadataObj;