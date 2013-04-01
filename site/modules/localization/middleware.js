'use strict';

var Localization = require('./lib/localization');

module.exports = function (scope, callback) {
    var extend = scope.get('utils').extend;
    var localization = new Localization(extend(
        scope.config.localization,
        { log: scope.log }
    ));

    var middleware = function (req, res, next) {
        if (!localization.isCompiled) {
            Object.keys(res.locals.lang).forEach(function(el) {
                var lang = res.locals.lang[el];
                localization.load(lang._scope.id, lang._base, lang._path);
            });

            localization.compile();
        }

        if (!res.locals.jss) {
            res.locals.jss = localization.getCompiled(req);
        } else {
            localization.getCompiled(req).forEach(function (src) {
                res.locals.jss.push(src);
            });
        }

        return next();
    };

    setImmediate(function () {
        callback(null, {
            index: [
                localization.getLocaleParser(),
                localization.getRegisterHelpers(),
                middleware
            ]
        });
    });
}