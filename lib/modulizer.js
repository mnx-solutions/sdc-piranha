'use strict';

var fs = require('fs');
var vasync = require('vasync');
var less = require('less');
var send = require('send');
var url = require('url');
var express = require('express');
var auth = require('./auth');

module.exports = Modulizer;

function Modulizer(app, opts) {
  if (this instanceof Modulizer === false) {
    return new Modulizer(app, opts);
  }

  this._opts = opts || {};
  this._path = this._opts.path || process.cwd();
  this._app = app;
  this._modules = {};
  this._apps = {};
  this._moduleList = [];
}

Modulizer.prototype.loadApps = function(apps) {
  var self = this;

  apps.forEach(function(app) {
    self._apps[app] = require(self._path + '/apps/' + app + '/index');
  });

  for (var i in self._apps) {
    var appl = self._apps[i];

    appl.modules.forEach(function(mod) {
      if (self._moduleList.indexOf(mod) === -1) {
        self._moduleList.push(mod);
      }
    });
  }
};

Modulizer.prototype.registerApps = function() {
  var self = this;

  this._app.use(this._createStaticLoader(['']));
  this.registerModuleStack();

  for (var i in this._apps) {
    var appl = this._apps[i];
    (function(appl) {
      var funcs = [function(req, res) {
        res.render(self._path + '/views/' + appl.index, {
          layouts: appl.layouts,
          csss: appl.csss,
          javascripts: appl.javascripts
        });
      }];

      if (appl.authenticate) {
        funcs.unshift(auth.getAuthenticator());
      }

      self._app.get(appl.route, funcs);
    })(appl);
  }
};

Modulizer.prototype.loadModuleStack = function(callback) {
  var self = this;
  var totalModules = self._moduleList.length;

  if (totalModules < 1) {
    return callback();
  }

  self._moduleList.forEach(function(mod) {
    var module = require(self._path + '/modules/' + mod + '/index.js');

    module.app = module.app || express();
    self._addStatic(mod, module.app);

    ['javascript', 'css', 'layouts'].forEach(function(el) {
      if (!module[el]) {
        module[el] = [];
      }
    });

    for (var i in module.javascripts) {
      module.javascripts[i] = '/' + mod + '/static/' + module.javascripts[i];
    }

    module.layouts.forEach(function(layout) {
      layout.include = '/' + mod + '/static' + firstSlash(layout.include);
      layout.module = mod;
    });

    self._modules[mod] = module;

    self._cssNamespace(mod, module, function(css) {
      module.csss = css;

      if (--totalModules === 0) {
        return self._fillAppStatics() && callback();
      }
    });
  });
};

Modulizer.prototype.registerModuleStack = function() {
  for (var i in this._modules) {
    this._app.use('/' + i, this._modules[i].app);
  }
};

Modulizer.prototype._fillAppStatics = function() {
  var self = this;
  for (var i in self._apps) {
    var appl = self._apps[i];
    appl.modules.forEach(function(mod) {
      ['csss', 'javascripts', 'layouts'].forEach(function(el) {
        if (self._modules[mod][el]) {
          self._modules[mod][el].forEach(function(item) {
            appl[el].push(item);
          });
        }
      });
    });
  }

  return true;
};

Modulizer.prototype._createStaticLoader = function(folders) {
  var self = this;

  return function staticLoader(req, res, next) {
    if (!req.url.match(/^\/static\//)) {
      return next();
    }

    var path = req.url;
    var i = 0;

    function createServlet(folders) {
      if (typeof folders[i] === 'undefined') {
        return next();
      }

      var realPath = url.parse(path).pathname;
      var root = folders[i];

      function onError(err){
        i++;
        createServlet(folders);
      }

      var root = root.length > 0 ? self._path + '/' + root : self._path;

      send(req, realPath)
        .root(root)
        .on('error', onError)
        .on('directory', onError)
        .pipe(res);
    }

    createServlet(folders);
  };
};

Modulizer.prototype._searchFile = function(file, module, callback) {
  var self = this;
  var path = this._path + '/extensions/' + module;

  fs.exists(path + file, function(exists) {
    if (exists) {
      return callback(null, path);
    }

    path = self._path + '/modules/' + module;
    fs.exists(path + file, function(exists) {
      if (exists) {
        return callback(null, path);
      }

      callback(new Error('File not found'));
    });
  });
};

Modulizer.prototype._addStatic = function(module, app) {
  for (var i in app.stack) {
    if (app.stack[i].route === '' && app.stack[i].handle.name === 'router') {
      app.stack.splice(i, 0, {
        route:'',
        handle: this._createStaticLoader(['extensions/' + module, 'modules/' + module])
      });
      return;
    }
  }

  app.stack.push({
    route:'',
    handle: this._createStaticLoader(['extensions/' + module, 'modules/' + module])
  });
};

Modulizer.prototype._cssNamespace = function(file, mod, callback) {
  var self = this;
  var csss = [];
  var count = mod.css.length;

  if (count === 0) {
    return callback();
  }

  /*
  // TODO: Use vasync and promises, nested callbacks are ugly
  vasync.pipeline({
    'funcs': [
      function(args, next) {
        self._searchFile(css, file + '/static', function(err, path) {
          if (err) {
            return next(err);
          }
        });
      },

      function(args, next) {
        next();
      },

      function(args, next) {
        next();
      }
    ]
  }, function(err, results) {
    console.log(arguments);
  });
  */

  mod.css.forEach(function(css) {
    css = firstSlash(css);

    self._searchFile(css, file + '/static', function(err, path) {
      if (err && --count === 0) {
        return callback(csss);
      }

      fs.readFile(path + css, 'utf8', function(err, data) {
        if (err) {
          console.log(err);
          process.exit();
        }

        data = '.JoyentPortal-module-' + file + '{ ' + data + ' } ';
        less.render(data, function(err, data){
          if (err) {
            console.log(err);
            process.exit();
          }

          var newfile = prependStr(css, 'namespaced');
          fs.writeFile(path + newfile, data, 'utf8', function(err) {
            if (err) {
              console.log(err);
              process.exit();
            }

            csss.push('/' + file + '/static' + newfile);
            if (--count === 0) {
              callback(csss);
            }
          });
        });
      });
    });
  });
}

function firstSlash(str) {
  if(str.charAt(0) !== '/'){
    str = '/' + str;
  }
  return str;
}

function prependStr(str, affix) {
  var arr = str.split('.');
  var end = arr.pop();
  arr.push(affix);
  arr.push(end);
  return arr.join('.');
}