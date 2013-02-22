'use strict';

var express = require('express');
var Module = require('./module');
var App = require('./app');
var vasync = require('vasync');
var Rack = require('easy-asset').Rack;
var utils = require('./utils');

module.exports = Modulizer;

function Modulizer(main) {
  if (this instanceof Modulizer === false) {
    return new Modulizer(main);
  }
  this.log = JP.getLog({lib: 'Modulizer'});
  Object.defineProperty(this, 'main', {get: function() {
      return main;
    }});
  this._modules = {};
  this._apps = {};
  this._rack = new Rack({
    preLoad: [
      'gzip',
      'jade',
      'less',
      require('./transformers/less-wrap'),
      'uglify-js',
      'sqwish'
    ]
  });
}

Modulizer.prototype.loadApps = function(apps) {
  this.log.info('Loading apps %o', apps);
  var self = this;
  apps.forEach(function(app) {
    self._apps[app] = new App(app);
    self._apps[app]._modules.forEach(function(mod) {
      if (!self._modules[mod]) {
        self._modules[mod] = new Module(mod);
      }
    });
  });
};

Modulizer.prototype.run = function(callback) {
  var self = this;
  self.log.info('Preparing to run app');
  self.init(function() {
    self.register(callback);
  });
};

Modulizer.prototype.init = function(callback) {
  var self = this;
  self.log.info('Initializing');
  self._initModules(function() {
    self._initApps(function() {
      self._assetizeApps(function() {
        callback();
      });
    });
  });
};

Modulizer.prototype._assetizeApps = function(callback) {
  var self = this;
  vasync.forEachParallel({
    func: self._assetizeApp.bind(self),
    inputs: Object.keys(self._apps)
  }, function(err, results) {
    callback();
  });
};

Modulizer.prototype._assetizeApp = function(name, callback) {
  var self = this;
  var app = self._apps[name];
  var locals = {
    javascripts: [],
    csss: [],
    layouts: [],
    templates: []
  };
  var barrier = vasync.barrier();

  barrier.on('drain', function() {
    app._locals = locals;
    callback();
  });

  barrier.start('javascripts');
  self._assetizeScripts(app._absLocals.javascripts, {
    ext: 'js',
    transform: ['uglify-js', 'gzip']
  }, function(err, scripts) {
    locals.javascripts = scripts;
    barrier.done('javascripts');
  });

  barrier.start('csss');
  self._assetizeScripts(app._absLocals.csss, {
    ext: 'css',
    transform: ['sqwish', 'gzip']
  }, function(err, scripts) {
    locals.csss = scripts;
    barrier.done('csss');
  });

  barrier.start('layouts');
  self._assetizeLayouts(app, function(err, layouts, templates) {
    locals.layouts = layouts;
    locals.templates = templates;
    barrier.done('layouts');
  });
};

Modulizer.prototype._assetizeScripts = function(input, combineOpts, callback) {
  var self = this;
  var result = [];
  vasync.forEachParallel({
    func: self._rack.addAsset.bind(self._rack),
    inputs: input
  }, function(err, results) {
    if (err) {
      self.log.fatal(err);
    }
    results.operations.forEach(function(res) {
      result.push(res.result);
    });

    self._rack.combineAssets(result, combineOpts, function(err, assets) {
      callback(err, assets);
    });
  });
};

Modulizer.prototype._assetizeLayouts = function(app, callback) {
  var self = this;
  var result = [];
  var templates = [];
  vasync.forEachParallel({
    func: function(layout, callback) {
      self._rack.addAsset(layout.include, function(err, include) {
        if (err) {
          return callback(err);
        }
        var l = utils.clone(layout);
        l.include = include;
        templates.push({
          id: include,
          data: self._rack.getAsset(include)._buffer.toString('utf8')
        });
        callback(null, l);
      });
    },
    inputs: app._absLocals.layouts
  }, function(err, results) {
    if (err) {
      self.log.fatal(err);
    }
    results.operations.forEach(function(res) {
      result.push(res.result);
    });
    callback(null, result, templates);
  });
};

Modulizer.prototype._initModules = function(callback) {
  var self = this;
  self.log.debug('Initializing modules');
  vasync.forEachParallel({
    func: function(mod, callback) {
      self._modules[mod].init(callback);
    },
    inputs: Object.keys(self._modules)
  }, function(err, results) {
    self.log.debug('Modules(%o) initialized', Object.keys(self._modules));
    callback(err);
  });
};

Modulizer.prototype._initApps = function(callback) {
  var self = this;
  self.log.debug('Initializing apps');
  vasync.forEachParallel({
    func: function(app, callback) {
      self._apps[app].init(self._modules, callback);
    },
    inputs: Object.keys(self._apps)
  }, function(err, results) {
    self.log.debug('Apps(%o) initialized', Object.keys(self._apps));
    callback(err);
  });
};

Modulizer.prototype.register = function(callback) {
  var self = this;
  self.log.debug('Adding paths to app');
  // Create main static loader
  self.main.use('', self._rack.createAssetLoader());
  self.main.use('', JP.createStaticLoader());
  self.main.use('', JP.createLogger());

  Object.keys(self._modules).forEach(function(mod) {
    self.main.use('/' + mod, self._modules[mod]._app);
  });

  Object.keys(self._apps).forEach(function(app) {
    self.main.get(self._apps[app].route, self._apps[app].indexHandler);
  });
  callback();
};