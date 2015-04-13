'use strict';

module.exports = function execute(app, log, config) {
    app.get('/locales', function (req, res) {
        res.json(config.localization.locales);
    });

    app.get('/translations', function (req, res) {
        res.json(res.locals.localizer.getLanguage(req));
    });
};