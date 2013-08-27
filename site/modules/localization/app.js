'use strict';

module.exports = function execute(scope, app) {
    app.get('/locales', function (req, res) {
        res.json(req.scope.config.localization.locales);
    });

    app.get('/translations', function (req, res) {
        res.json(res.locals.localizer.getLanguage(req));
    });
};