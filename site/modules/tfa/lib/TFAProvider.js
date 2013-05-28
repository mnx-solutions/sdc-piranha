'use strict';

// TODO: we might prefer using authy or duo-security,
// so I've tried to keep this a little "over-engineered" and generic

// We use callback

var speakeasy = require('speakeasy');

// Important values for Google Authenticator
var config = {
    encoding: 'base32',
    timeInterval: 20
};

// account parameter is ignored.
function generateSecret () {
    var secret = speakeasy.generate_key({
        length: config.timeInterval, // required to be 20, on the github/speakeasy page, but not sure what it does
        google_auth_qr: false
    });
    return secret[config.encoding];
}

function generateOTP (secretkey) {
    return speakeasy.totp({
        key: secretkey,
        encoding: config.encoding
    });
}

function getQRcode (secretkey, keyname) {
    if (!secretkey){
        return '';
    }
    //var name = 'Joyent (' + keyname.replace('/', '') + ')';
    var name = (keyname || 'my') + '@joyent';
    return 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl='
        + 'otpauth://totp/'
        + encodeURIComponent(name)
        + '%3Fsecret='
        + encodeURIComponent(secretkey);
}

module.exports = {
    generateSecret: generateSecret,
    generateOTP: generateOTP,
    getQRcode: getQRcode
};
