'use strict';

var util = require('util');

Object.keys(util).forEach(function(key) {
  module.exports[key] = util[key];
});

function clone(obj) {
  if (typeof obj !== 'object') {
    return obj;
  }
  if (util.isArray(obj)) {
    var ret = [];
    obj.forEach(function(val) {
      ret.push(clone(val));
    });
    return ret;
  }
  var ret = {};
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

module.exports.clone = clone;
module.exports.firstSlash = firstSlash;
module.exports.checkPush = checkPush;
