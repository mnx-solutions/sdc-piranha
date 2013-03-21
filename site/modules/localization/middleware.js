'use strict';

var Localization = require('./lib/localization');

module.exports = function (scope, callback) {
    var Local = new Localization(scope.config.localization);
    var loaded = false;

<<<<<<< HEAD
  var middleware = function (req, res, next) {
    if (!loaded) {
      Object.keys(res.locals.lang).forEach(function(el) {
        var lang = res.locals.lang[el];
        Local.load(lang._scope.id, lang._base, lang._path);
      });
      Local.compile();
      loaded = true;
    }
    if (!res.locals.jss) {
      res.locals.jss = Local.getCompiled(req);
    } else {
      Local.getCompiled(req).forEach(function (src) {
        res.locals.jss.push(src);
      });
    }
    next();
  };
=======
    var middleware = function (req, res, next) {
        if (!loaded) {
            Object.keys(res.locals.lang).forEach(function(el) {
                var lang = res.locals.lang[el];
                Local.load(lang._scope.id, lang._base, lang._path);
            });
            Local.compile();
            loaded = true;
        }
        if (!res.locals.jss) {
            res.locals.jss = Local.getCompiled(req);
        } else {
            Local.getCompiled(req).forEach(function (src) {
                res.locals.jss.push(src);
            });
        }
        next();
    };
>>>>>>> origin/master

    setImmediate(function () {
        callback(null, [Local.getLocaleParser(), Local.getRegisterHelpers(), middleware]);
    });
}