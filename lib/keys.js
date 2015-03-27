'use strict';

var config = require('easy-config');
var ursa = require('ursa');
var fs = require('fs');

function createKeyPairObject(key, name) {
    return {
        privateKey: key.toPrivatePem('utf8'),
        publicKey: 'ssh-rsa ' + key.toPublicSsh('base64') + ' ' + name,
        fingerprint: key.toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1)
    };
}

function getKeyPair(client, call, path, name, callback) {
    var key;

    if (call.req.session.privateKey) {
        key = ursa.createPrivateKey(call.req.session.privateKey);
        return callback(createKeyPairObject(key, name));
    }
    client.getFileContents(path, function (error, privateKey) {
        if (error && config.manta && config.manta.privateKey) {
            privateKey = fs.readFileSync(config.manta.privateKey, 'utf-8');
        }
        if (!privateKey) {
            key = ursa.generatePrivateKey();
        } else {
            key = ursa.createPrivateKey(privateKey);
        }

        callback(createKeyPairObject(key, name));
    });
}

module.exports.getKeyPair = getKeyPair;