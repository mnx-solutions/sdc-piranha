var config = require('easy-config');

var features = {};

// Modify features to allow 'yes' and 'no'
Object.keys(config.features).forEach(function (feature) {
    var tmp = config.features[feature];
    features[feature] = (tmp === 'yes' || tmp === 'enabled' ? 'enabled' : 'disabled');
});

// Feature dependencies
if (features.privateSdc === 'enabled') {
    features.promocode = features.invoices = features.promoBillingConfirmation =
        features.phoneVerification = features.freetier = features.slb =
        features.createdBySupportPackages = features.systemStatus =
        features.devCenterNewsTile = features.downloadSdc = features.usageData =
        features.limitedSlb = features.support = features.skinChange =
        features.provisioningLimits = features.zendesk = features.feedback =
        features.blogEntries = features.marketo = features.twitter =
        features.googleAnalytics = features.billing = features.maxmind = 'disabled';
    config.capishim.noUpdate = true;
    config.modify({capishim: config.capishim});
}
if (features.zendesk === 'disabled') {
    features.createdBySupportPackages = 'disabled';
}
if (features.imageUse === 'disabled') {
    features.imageCreate = 'disabled';
}
if (features.billing === 'disabled') {
    features.support = features.invoices = features.usageData = features.provisioningLimits = 'disabled';
    features.allowSkipBilling = 'enabled';
    config.billing.noUpdate = true;
    config.modify({billing: config.billing});
}

if (features.networking !== 'disabled') {
    var networkingDatacenters = config.networkingDatacenters;
    if (networkingDatacenters) {
        if (!config.networkingDatacenters.length) {
            features.networking = 'disabled';
        }
    }
}

var isMantaConfigValid = config.manta && config.manta.hasOwnProperty('url');
if (features.fileStorage === 'enabled') {
    features.mantaJobs = features.cdn = features.mdb = features.dtrace = features.usageData = 'disabled';
    isMantaConfigValid = config.fileStorage && config.fileStorage.root;
}
if (features.manta !== 'enabled' || !isMantaConfigValid) {
    features.manta = features.cdn = features.mdb = features.docker = features.dtrace =
        features.fileStorage = features.usageData = 'disabled';
}
config.modify({features: features});

module.exports = features;
