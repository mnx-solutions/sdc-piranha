'use strict';

var smartdc = require('smartdc');
var crypto = require('crypto');
var fs = require('fs');

function getRequestSigner(opts) {
	return function(date, callback) {
		fs.readFile(opts.keyPath, function(err, data) {
			if (err) {
				callback(err);
				return;
			}

			var signer = crypto.createSign('RSA-SHA256');
			signer.update(date);

			var signedData = signer.sign(data.toString(), 'base64');

			if (signedData) {
				callback(null, {
					user: opts.username,
					keyId: opts.keyId,
					algorithm: 'RSA-SHA256',
					signature: signedData
				});
			} else {
				callback(new Error('Can\'t sign request data'));
			}
		});
	};
}

module.exports = function (req, res, next) {
	var cloudUrl = req.scope.config.cloudapi.url;

	var logger = req.log.child({module: "cloudapi"});

	// if logged from UI, use credentials from session
	if (req.session.login) {
		req.cloud = smartdc.createClient({
			url: cloudUrl,
			username: req.session.login.username,
			password: req.session.login.password,
			logger: req.log
		});
		return next();
	}

    if (req.scope.config.cloudapi && req.scope.config.cloudapi.keyId && req.scope.config.cloudapi.keyPath) {
        // if key is configured, use it.
        req.cloud = smartdc.createClient({
            url: cloudUrl,
            sign: getRequestSigner(req.scope.config.cloudapi),
            logger: logger
        });

        return next();
    }

	if (req.scope.config.cloudapi && req.scope.config.cloudapi.username && req.scope.config.cloudapi.password) {
		// if username is in configuration, use it.
		req.cloud = smartdc.createClient({
			url: cloudUrl,
			username: req.scope.config.cloudapi.username,
			password: req.scope.config.cloudapi.password,
			logger: logger
		});
		return next();
	}


	return res.redirect('/login');
};