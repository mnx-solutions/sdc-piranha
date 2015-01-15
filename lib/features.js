var config = require('easy-config');

var features = {};

// Modify features to allow 'yes' and 'no'
Object.keys(config.features).forEach(function (feature) {
    var tmp = config.features[feature];
    features[feature] = (tmp === 'yes' || tmp === 'enabled' ? 'enabled' : 'disabled');
});

// Feature dependencies
if (features.localSdc === 'enabled') {
    features.promocode = features.invoices = features.promoBillingConfirmation =
        features.phoneVerification = features.freetier = features.slb =
        features.createdBySupportPackages = features.systemStatusTile =
        features.devCenterNewsTile = features.downloadSdc = features.usageData =
        features.limitedSlb = features.support = features.skinChange =
        features.provisioningLimits = features.zendesk = features.feedback =
        features.blogEntries = features.marketo = features.twitter =
        features.googleAnalytics = features.billing = 'disabled';
    config.capishim.noUpdate = true;
    config.modify({capishim: config.capishim});
}
if (features.zendesk === 'disabled') {
    features.createdBySupportPackages = 'disabled';
}
if (features.billing === 'disabled') {
    features.support = features.invoices = features.usageData = features.provisioningLimits = 'disabled';
    features.allowSkipBilling = 'enabled';
    config.billing.noUpdate = true;
    config.modify({billing: config.billing});
}
if (features.manta === 'enabled') {
    var isMantaConfigValid = config.manta && config.manta.hasOwnProperty('url');
    if (!isMantaConfigValid) {
        features.manta = features.mdb = features.docker = 'disabled';
    }
}
config.modify({features: features});

module.exports = features;