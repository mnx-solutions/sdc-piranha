var smartdc = require('smartdc');
var utils = require('./utils');


module.exports = Authentication;

function Authentication() {
}

Authentication.getAuthenticator = function () {
    return function (req, res, next) {
        var cloudUrl = global.JP.config.cloudapi.url;

        var logger = req.log.child({module: "cloudapi"});

        // if logged from UI, use credentials from session
        if (req.session.login != null) {
            req.cloud = smartdc.createClient({url: cloudUrl,
                username: req.session.login.username,
                password: req.session.login.password,
                logger: req.log});
            return next();
        } else if (global.JP.config.cloudapi && global.JP.config.cloudapi.username && global.JP.config.cloudapi.password) {
            // if username is in configuration, use it.
            req.cloud = smartdc.createClient({url: cloudUrl,
                username: global.JP.config.cloudapi.username,
                password: global.JP.config.cloudapi.password,
                logger: logger});
            return next();
        } else if (global.JP.config.cloudapi && global.JP.config.cloudapi.keyId && global.JP.config.cloudapi.keyPath) {
            // if key is configured, use it.
            req.cloud = smartdc.createClient({
                url: cloudUrl,
                sign: utils.getRequestSigner(global.JP.config.cloudapi),
                logger: logger
            });

            return next();
        }

        return res.redirect('/login');
    };
};