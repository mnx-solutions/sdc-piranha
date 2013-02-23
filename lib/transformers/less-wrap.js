'use strict';

var path = require('path');

module.exports = {
  id: 'less-wrap',
  match: function(asset) {
    return asset._mime.match(/css/) && asset._opts.module;
  },
  contents: function(contents, callback) {
    var tmp = [];
    tmp.push(new Buffer('.JoyentPortal-module-' + this._opts.module + '{'));
    tmp.push(contents);
    tmp.push(new Buffer('}'));
    process.nextTick(function() {
      callback(null, Buffer.concat(tmp));
    });
  },
  preCompile: true,
  headers: false
};