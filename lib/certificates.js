'use strict';
var os = require('os');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var vasync = require('vasync');
var EventEmitter = require('events').EventEmitter;
var emitters = {};
var CERTIFICATES_KEYS = ['ca', 'server-cert', 'server-key'];

function generateCertificates(mantaClient, outputDir, callback) {
    var tmpDir = path.join(os.tmpdir(), Math.random().toString(16).substr(2));
    var emitterKey = mantaClient.user + '-' + outputDir;
    var emitter = emitters[emitterKey];
    if (emitter) {
        return emitter.on('certificates', callback);
    }
    emitter = emitters[emitterKey] = new EventEmitter;
    emitter.setMaxListeners(0);
    emitter.on('certificates', callback);

    var options = {
        env: {
            KEYS_PATH: tmpDir
        }
    };
    var CERT_FILES_MAP = {
        'ca.pem': 'ca',
        'cert.pem': 'cert',
        'key.pem': 'key',
        'server-cert.pem': 'server-cert',
        'server-key.pem': 'server-key'
    };
    var certificates = {checked: true};
    function done(error) {
        delete emitters[emitterKey];
        emitter.emit('certificates', error, certificates);
    }

    var child = exec(__dirname + '/../tools/generate-certificates.sh', options, function (error) {
        if (error) {
            done(error);
        }
    });

    child.on('error', done);

    child.on('close', function () {
        fs.readdir(tmpDir, function (readDirError, files) {
            if (readDirError) {
                return done(readDirError);
            }
            vasync.forEachParallel({
                inputs: files,
                func: function (file, callback) {
                    var filePath = path.join(tmpDir, file);
                    var fileContent = fs.readFileSync(filePath, 'utf-8');
                    var certKey = CERT_FILES_MAP[file];
                    if (certKey && !certificates[certKey]) {
                        certificates[certKey] = fileContent;
                    }
                    mantaClient.putFileContents(path.join(outputDir, file), fileContent, function (putError) {
                        if (putError) {
                            return callback(putError);
                        }
                        fs.unlink(filePath, callback);
                    });
                }
            }, function (errors) {
                if (errors) {
                    return done(errors);
                }
                fs.rmdir(tmpDir, function (rmError) {
                    done(rmError);
                });
            });
        });
    });
}

function applyVariablesToScript(script, certificates, keyPair, mantaClient, subuserLogin) {
    return script.replace('%__private-key__%', keyPair.privateKey).
        replace('%__public-key__%', keyPair.publicKey).
        replace('%__manta-account__%', mantaClient.user).
        replace('%__manta-subuser__%', subuserLogin).
        replace('%__manta-url__%', mantaClient._url).
        replace('%__ca__%', certificates.ca).
        replace('%__server-cert__%', certificates['server-cert']).
        replace('%__server-key__%', certificates['server-key']).
        replace('%__disable-tls__%', '');
}

function areCertificatesLost(certificates) {
    return CERTIFICATES_KEYS.some(function (key) {
        return !certificates[key];
    });
}

exports.areCertificatesLost = areCertificatesLost;
exports.generateCertificates = generateCertificates;
exports.applyVariablesToScript = applyVariablesToScript;
