'use strict';

var Localization = require('./lib/localization');

var extend = require('../../../lib/utils').extend;
var config = require('easy-config');
var bunyan = require('bunyan')
var localization = new Localization(extend(config.localization, {
    log: bunyan.createLogger(config.log)
}));

var middleware = function localizationMiddleware(req, res, next) {
    if (!localization.isCompiled) {
        console.log('Locals: ', res.locals);
        Object.keys(res.locals.lang).forEach(function(el) {
            var lang = res.locals.lang[el];
            localization.load(lang._scope.id, lang._base, lang._path);
        });

        localization.compile();
    }

    if (!res.locals.jss) {
        res.locals.jss = [];
    }

    var compiledLocalizations = localization.getCompiled(req);
    Object.keys(compiledLocalizations).forEach(function (key) {
        res.locals.jss.push(compiledLocalizations[key]);
    });

    return next();
};

module.exports = [
/*
// After getting rid of express-modulizer, localization not supported and should be adapted or removed
    localization.getLocaleParser(),
    localization.getRegisterHelpers(),
    middleware
*/
];
