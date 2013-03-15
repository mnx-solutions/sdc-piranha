'use strict';

var fs = require('fs');
var crypto = require('crypto');
var smartdc = require('smartdc');
var util = require('util');

Object.keys(util).forEach(function(key) {
  module.exports[key] = util[key];
});

function clone(obj) {
  if (typeof obj !== 'object') {
    return obj;
  }
  var ret;
  if (util.isArray(obj)) {
    ret = [];
    obj.forEach(function(val) {
      ret.push(clone(val));
    });
    return ret;
  }
  ret = {};
  Object.keys(obj).forEach(function(key) {
    ret[key] = clone(obj[key]);
  });
  return ret;
}

function firstSlash(str) {
  if (str.charAt(0) !== '/') {
    str = '/' + str;
  }
  return str;
}

function checkPush(arr, item) {
  if (arr.indexOf(item) === -1) {
    arr.push(item);
  }
  return arr;
}

function getRequestSigner(opts) {
    return function(date, callback) {
        fs.readFile(opts.keyPath, function(err, data) {
            if (err) {
                callback(err);
                return;
            }

            var signer = crypto.createSign('RSA-SHA256');
            signer.update(date);

            console.log(date);

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

module.exports.clone = clone;
module.exports.firstSlash = firstSlash;
module.exports.checkPush = checkPush;
module.exports.getRequestSigner = getRequestSigner;