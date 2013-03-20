'use strict';

module.exports = function (scope, app, callback) {
    app.get('/locales', function (req, res, next) {
        res.json(req.scope.config.localization.locales);
    });

    app.get('/translations', function (req, res, next) {
        res.json(res.locals.localizer.getLanguage(req));
    });

    setImmediate(callback);
};