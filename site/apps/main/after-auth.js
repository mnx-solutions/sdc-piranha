var config = require('easy-config');
var path = require('path');
var vasync = require('vasync');

var services = [];
if (config.features.docker === 'enabled') {
    services.push('docker');
}
if (config.features.dtrace === 'enabled') {
    services.push('dtrace');
}
var CERT_FILES = ['ca', 'cert', 'key', 'server-cert', 'server-key'];

function loadUserCertificates(req, service, callback) {
    var client = require('../../modules/storage').MantaClient.createClient({log: req.log, req: req});
    var certificates = req.session[service];
    vasync.forEachParallel({
        inputs: CERT_FILES,
        func: function (name, callback) {
            var filePath = path.join('~~/stor/.joyent', service, name + '.pem');
            client.getFileContents(filePath, function (error, body) {
                certificates[name] = body;
                callback(error);
            });
        }
    }, function (errors) {
        if (errors) {
            req.session[service] = {checked: true};
        }
        callback();
    });
}

module.exports = function loadUserCertificatesMiddleware(req, res, next) {
    if (config.features.manta !== 'enabled') {
        return;
    }

    vasync.forEachParallel({
        inputs: services,
        func: function (service, callback) {
            var certificates = req.session[service] = req.session[service] || {checked: false};
            var loaded = CERT_FILES.every(function (key) {
                return certificates[key];
            });
            if (loaded || certificates.checked) {
                certificates.checked = true;
                return callback();
            }
            loadUserCertificates(req, service, function () {
                certificates.checked = true;
                callback.apply(this, arguments);
            });
        }
    }, function () {
        next();
    });
};
