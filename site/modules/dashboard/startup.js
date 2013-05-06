'use strict';

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    var langs = {};
    var oldLangs = {};
    scope.config.localization.locales.forEach(function (lng) {
        langs[lng] = {};
    });

    setImmediate(callback);
};
