'use strict';

var Localization = require('./lib/localization');

module.exports = function execute(scope) {
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
            var comp = localization.getCompiled(req);
            Object.keys(comp).forEach(function (key) {
                res.locals.jss[key] = comp[key];
            });
        }

        return next();
    };

    return {
        index: [
            localization.getLocaleParser(),
            localization.getRegisterHelpers(),
            middleware
        ]
    };
};