'use strict';

var App;
var vasync = require('vasync');
var utils = require('./utils');
var path = require('path');
var less = require('less');
var fs = require('fs');

module.exports = FileResolver;

/**
 * FileResolver is a class meant to map app and module files
 * @param {Object} parent
 * @returns {FileResolver}
 */
function FileResolver(parent) {
  App = require('./app'); // Workaround for require circular error
  if (this instanceof FileResolver === false) {
    return new FileResolver(parent);
  }
  this.parent = parent;
  this.log = parent.log;
}

/**
 *
 * @param {String} type -> folder
 * @param {String} name -> app or module name
 * @returns {String}
 */
FileResolver.prototype.resolve = function(type, name) {
  if (type === 'modules' && !name) {
    return JP.root;
  }
  return JP.root + path.sep + type + (name ? path.sep + name : '');
};

/**
 * Convenience function to resolve app path
 * @param {String} name -> app name
 * @returns {String}
 */
FileResolver.prototype.resolveApp = function(name) {
  return this.resolve('apps', name);
};
/**
 * Convenience function to resolve module path
 * @param {String} name -> module name
 * @returns {String}
 */
FileResolver.prototype.resolveModule = function(name) {
  return this.resolve('modules', name);
};
/**
 * Convenience function to resolve extension path
 * @param {String} name -> extension name
 * @returns {String}
 */
FileResolver.prototype.resolveExtension = function(name) {
  return this.resolve('extensions', name);
};
/**
 * Function for resolving static folder
 * @param {String} type -> component type
 * @param {String} name -> component name
 * @returns {String}
 */
FileResolver.prototype.resolveStatic = function(type, name) {
  return this.resolve(type, name) + path.sep + 'static';
};
/**
 * Function for getting the full path to a file
 * @param {String} module -> component name
 * @param {String} fileName -> relative filepath
 * @param {String} type -> component type
 * @returns {String}
 */
FileResolver.prototype.resolveStaticFile = function(component, fileName, type) {
  return this.resolveStatic(type, component) + utils.firstSlash(fileName);
};

/**
 * Function for resolving component file paths
 * @param {Function} callback
 */
FileResolver.prototype.resolveFiles = function(callback) {
  var self = this;
  self.log.info('Resolving files');

  var confs = [
    {
      name: 'javascripts',
      func: self.resolveFile.bind(self)
    },
    {
      name: 'csss',
      func: self.resolveFile.bind(self)
    },
    {
      name: 'layouts',
      func: function(layout, callback) {
        self.resolveFile(layout.include, function(err, file) {
          if (err) {
            return callback(err);
          }
          var newLayout = utils.clone(layout);
          newLayout.include = file;
          callback(null, newLayout);
        });
      }
    }
  ];

  // Create barrier to be called upon completion
  var barrier = vasync.barrier();
  barrier.on('drain', function() {
    self.log.debug('Finished resolving files');
    callback();
  });

  confs.forEach(function(conf) {
    barrier.start(conf.name);
    self.resolveFilesBatch(conf.name, conf.func, function() {
      barrier.done(conf.name);
    });
  });
};

/**
 * Function for resolving a batch of similar files
 * @param {String} name -> group name
 * @param {Function} func -> resolving function
 * @param {Function} callback
 */
FileResolver.prototype.resolveFilesBatch = function(name, func, callback) {
  var self = this;
  var arr = self.parent._module[name];
  var app = self.parent instanceof App;
  var res = app ? self.parent._absLocals[name] : self.parent._locals[name];

  self.log.debug('Resolving %s ' + name + ' files', arr.length);
  vasync.forEachParallel({
    func: func,
    inputs: arr
  }, function(err, results) {
    results.operations.forEach(function(op) {
      res.push(op.result);
    });
    self.log.debug('%s ' + name + ' files resolved', res.length);
    callback();
  });
};

/**
 * Function for resolving a single file
 * @param {String} file -> relative filepath
 * @param {Function} callback
 */
FileResolver.prototype.resolveFile = function(file, callback) {
  var self = this;
  var app = self.parent instanceof App;

  self.log.debug('Looking for file %s', file);
  if (file.indexOf('//') === 0) {
    return callback(null, {url: file, file: false});
  }
  self.searchFile(app ? '' : self.parent.name, file, function(type, filePath) {
    if (!type) {
      // Decided to break on every error, so we die here
      self.log.fatal('Registered file (%s) not found', file);
    }

    self.log.debug('File %s found in %s', file, type);
    var res = {
      file: filePath,
      url: (app ? '' : '/' + self.parent.name) +
              (type === 'modules' ? '/static' : '/extensions') +
              utils.firstSlash(file),
      transform: ['gzip']
    };
    // See if we are dealing with module css
    var extname = path.extname(file);
    if (extname === '.css' || extname === '.less') {
      if (!app) {
        res.transform.unshift('less');
        res.transform.unshift('less-wrap');
        res.module = self.parent.name;
      } else if (extname === '.less') {
        res.transform.unshift('less');
      }
    }
    callback(null, res);
  });
};

/**
 * Function for looking for a file under extensions and then static
 * @param {String} module -> component name
 * @param {String} filePath -> relative file path
 * @param {Function} callback
 */
FileResolver.prototype.searchFile = function(component, filePath, callback) {
  var self = this;
  var absFilePath = self.resolveStaticFile(component, filePath, 'extensions');
  fs.exists(absFilePath, function(exists) {
    if (exists) {
      return callback('extensions', absFilePath);
    }
    absFilePath = self.resolveStaticFile(component, filePath, 'modules');
    fs.exists(absFilePath, function(exists) {
      if (exists) {
        return callback('modules', absFilePath);
      }
      callback(false);
    });
  });
};
