var smartdc = require('smartdc');
var utils = require('./utils');


module.exports = Authentication;

function Authentication() {
}

Authentication.getAuthenticator = function () {
    return function (req, res, next) {
        var cloudUrl = global.JP.config.cloudapi.url;

        req.cloud = smartdc.createClient({
            url: cloudUrl,
            sign: utils.getRequestSigner(global.JP.config.cloudapi)
        });

        return next();
    };
};