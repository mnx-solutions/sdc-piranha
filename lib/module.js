'use strict';

var express = require('express');
var vasync = require('vasync');
var utils = require('./utils');
var auth = require('./auth');
var FileResolver = require('./file-resolver');

var JP = null;

/*
 * Wrapper for a module
 */
function Module(name) {
  JP = global.JP;

  if (this instanceof Module === false) {
    return new Module(name);
  }

  this.name = name;
  this.log = JP.getLog({module: name});

  this._fileResolver = new FileResolver(this);

  this._path = this._fileResolver.resolveModule(name);
  this._module = require(this._path);

  this._locals = {
    javascripts: [],
    csss: [],
    layouts: []
  };
  this._preInit();
  return this;
}

/**
 * Function for copying properties from _module
 */
Module.prototype._preInit = function() {
  // See if we have app, create if not
  this._app = this._module.app || express();
  // See if there is an api, init if not
  this._api = this._module.api || {};

  this._auth = this._getAuthenticator();
  // Make sure all locals exist on module
  for (var i in this._locals) {
    if (!utils.isArray(this._module[i])) {
      this._module[i] = [];
    }
  }
};
/**
 * Initializer function - will resolve filenames and register module
 * @param {Function} callback
 */
Module.prototype.init = function(callback) {
  this.log.debug('Initializing');

  this._addStatic();
  this._addLogger();

  JP.registerModuleAPI(this.name, this._api);

  this._fileResolver.resolveFiles(function() {
    callback();
  });

};

Module.prototype._getAuthenticator = function() {
  if (!this._module.authenticate) {
    return false;
  }
  if (typeof this._module.authenticate === 'function') {
    return this._module.authenticate;
  } else {
    return auth.getAuthenticator();
  }
};

/**
 * Function for adding a static file route to module app stack
 * @returns {unresolved}
 */
Module.prototype._addStatic = function() {
  this.log.info('Add static loader to stack');
  this._addBeforeRouter({
    route: '',
    handle: JP.createStaticLoader(this.name)
  });
};

/**
 * Function for adding a module specific logger to stack
 * @returns {unresolved}
 */
Module.prototype._addLogger = function() {
  var self = this;
  self.log.info('Add logger to stack');

  self._addBeforeRouter({
    route: '',
    handle: function(req, res, next) {
      req.log = req.log.child({module: self.name});
      next();
    }
  });
};

/**
 * Function for adding a handler to stack before the router
 * @param {type} handler
 */
Module.prototype._addBeforeRouter = function(handler) {
  this.log.debug('Add a handler before router');
  var stack = this._app.stack;
  for (var i in stack) {
    if (stack[i].route === '' && stack[i].handle.name === 'router') {
      stack.splice(i, 0, handler);
      return;
    }
  }
  stack.push(handler);
};

module.exports = Module;