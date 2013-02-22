'use strict';

var auth = require('./auth');
var FileResolver = require('./file-resolver');
var utils = require('./utils');
var vasync = require('vasync');

function App(name) {
  if (this instanceof App === false) {
    return new App(name);
  }
  this.name = name;
  this.log = JP.getLog({app: name});

  this._fileResolver = new FileResolver(this);

  this._path = this._fileResolver.resolveApp(name);
  this._module = require(this._path);

  this._modules = [];

  this._absLocals = {
    javascripts: [],
    csss: [],
    layouts: []
  };

  this._locals = {
    javascripts: [],
    csss: [],
    layouts: []
  };

  this._preInit();
}

/**
 * Function for preparing necessary properties
 */
App.prototype._preInit = function() {
  this.log.debug('Preiniting');
  this._modules = this._module.modules ? this._module.modules.slice(0) : [];
  // Make sure all locals exist on module
  for (var i in this._locals) {
    if (!utils.isArray(this._module[i])) {
      this._module[i] = [];
    }
  }

  this._auth = this._getAuthenticator();
  this._index = this._module.index || 'index.jade';
  this.route = this._module.route || '/' + this.name;
};

App.prototype.init = function(modules, callback) {
  var self = this;
  self.log.debug('Initializing');
  self._fileResolver.resolveFiles(function() {
    self._fillLocals(modules);
    self._createIndex();
    callback();
  });
};

App.prototype._createIndex = function() {
  var self = this;
  self.log.debug('Creating index');
  var funcs = [function(req, res, next) {
      res.locals = utils.clone(self._locals);
      res.render(self._index);
    }];
  if (self._auth) {
    funcs.unshift(self._auth);
  }
  self.indexHandler = funcs;
};

App.prototype._fillLocals = function(modules) {
  var self = this;
  self.log.debug('Filling locales');
  self._fillAbsLocals(modules);
  self._absLocals.javascripts.forEach(function(js) {
    utils.checkPush(self._locals.javascripts, js.url);
  });
  self._absLocals.csss.forEach(function(css) {
    utils.checkPush(self._locals.csss, css.url);
  });
  self._absLocals.layouts.forEach(function(layout) {
    var l = utils.clone(layout);
    l.include = layout.include.url;
    utils.checkPush(self._locals.layouts, l);
  });
};

App.prototype._fillAbsLocals = function(modules) {
  var self = this;
  self._modules.forEach(function(mod) {
    if (!modules[mod]) {
      self.log.fatal('Module %s missing', mod);
      process.exit(1);
    }
    modules[mod]._locals.javascripts.forEach(function(js) {
      utils.checkPush(self._absLocals.javascripts, js);
    });
    modules[mod]._locals.csss.forEach(function(css) {
      utils.checkPush(self._absLocals.csss, css);
    });
    modules[mod]._locals.layouts.forEach(function(layout) {
      utils.checkPush(self._absLocals.layouts, layout);
    });
  });
};

App.prototype._getAuthenticator = function() {
  if (!this._module.authenticate) {
    return false;
  }
  if (typeof this._module.authenticate === 'function') {
    return this._module.authenticate;
  } else {
    return auth.getAuthenticator();
  }
};


module.exports = App;