'use strict';

var config = require('easy-config');
var bunyan = require('bunyan');
var path = require('path');
var send = require('send');
var url = require('url');
var uuid = require('uuid');
var utils = require('./utils');
var FileResolver = require('./file-resolver');

var logger = bunyan.createLogger(config.log);

function wrapLogger(logi) {
  var fatal = logi.fatal;
  var child = logi.child;
  logi.fatal = function() {
    fatal.apply(logi, arguments);
    process.exit(1);
  };
  logi.child = function() {
    var log = child.apply(logi, arguments);
    return wrapLogger(log);
  };
  return logi;
}

wrapLogger(logger);

function JP(root) {
  if (this instanceof JP === false) {
    return new JP(root);
  }
  root = normalRoot(root);
  Object.defineProperty(this, 'root', {
    get: function() {
      return root;
    }
  });
  Object.defineProperty(this, 'config', {
    get: function() {
      return config;
    }
  });

  this._fileResolver = new FileResolver({
    log: this.getLog({lib: 'FileResolver'})
  });

  this._modules = {};
  return this;
}

function normalRoot(root) {
  if (!root) {
    return process.cwd();
  }

  root = path.normalize(root);
  var arr = root.split(path.sep);
  if (arr[arr.length - 1] === '') {
    arr.pop();
  }
  return arr.join(path.sep);
}

JP.prototype.getLog = function(child) {
  if (child) {
    return logger.child(child);
  }
  return logger;
};

JP.prototype.createStaticLoader = function(name) {
  var self = this;
  var staticRoot = self._fileResolver.resolveModule(name);
  var extensionRoot = self._fileResolver.resolveStatic('extensions', name);

  return function staticLoader(req, res, next) {
    if (!req.url.match(/^\/static\//) && !req.url.match(/^\/extensions\//)) {
      next();
      return;
    }
    var realPath;
    var root;
    if (req.url.match(/^\/static\//)) {
      realPath = url.parse(req.url).pathname;
      root = staticRoot;
    } else {
      realPath = url.parse(req.url.replace('/extensions', '')).pathname;
      root = extensionRoot;
    }
    function onError(err) {
      return next();
    }
    send(req, realPath)
            .root(root)
            .on('error', onError)
            .on('directory', onError)
            .pipe(res);
  };

};

JP.prototype.registerModuleAPI = function(name, api) {
  this._modules[name] = api;
};

JP.prototype.getModuleAPI = function(name) {
  return this._modules[name] || null;
};

JP.prototype.createLogger = function() {
  var self = this;
  var counter = 0;
  return function loggerMiddleware(req, res, next) {
    req.log = self.getLog({req_id: uuid.v4()});
    next();
  };
};

module.exports = JP;