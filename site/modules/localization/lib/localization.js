'use strict';

var util = require('util');

function Localization(opts) {
    if (!(this instanceof Localization)) {
        return new Localization(opts);
    }

    var self = this;

    this._defaultLocale = opts.defaultLocale;
    this._locales = opts.locales;
    this._log = opts.log || null;

    this._compiled = {};
    this._translations = {
        lng: {},
        mod: {}
    };

    Object.defineProperty(this, 'isCompiled', {
        get: function () {
            for (var i = 0, c = self._locales.length; i < c; i++) {
                var locale = self._locales[i];

                if (!self._compiled.hasOwnProperty(locale)) {
                    return false;
                }
            }

            return true;
        }
    });
}

/**
 * Resolve translation string placeholders
 *
 * @private
 * @static
 * @param str translation string
 * @param params translation map
 * @returns {string}
 */
Localization._resolve = function (str, params) {
    return str.replace(/\{\{(\w+)\}\}/g, function (match, key) {
        return params.hasOwnProperty(key) ? params[key] : '';
    });
};

/**
 * Parse language identifiers
 *
 * @private
 * @static
 * @param identifier
 * @returns {{}}
 */
Localization._parseLocaleIdentifier = function (identifier) {
    var locale = {};

    // Find language group and local region
    if (identifier.indexOf('-') !== -1) {
        var atoms = identifier.split('-');
        locale.group = atoms[0];
        locale.region = atoms[1];
    } else {
        locale.group = identifier;
        locale.region = null;
    }

    return locale;
};

/**
 * Check if a locale exists
 *
 * @public
 * @static
 * @param locale
 * @returns {boolean} true if locale is enabled, otherwise false
 */
Localization.prototype.isSupportedLocale = function (locale) {
    return this._locales.indexOf(locale) !== -1;
};

/**
 * Set current session locale
 *
 * @public
 * @static
 * @param req
 * @param locale
 */
Localization.prototype.setLocale = function (req, locale) {
    if (this.isSupportedLocale(locale)) {
        if (req.session) {
            req.log.trace('Change session locale from %s to %s',
                req.session.locale, locale);

            req.session.locale = locale;
            req.session.save();
            return true;
        } else {
            req.log.debug('Can\'t change locale to %s, session is not present', locale);
            return false;
        }
    } else {
        req.log.debug('Can\'t change locale to %s, unsupported', locale);
    }

    return false;
};

/**
 * Return current session locale
 *
 * @param req
 * @returns {string}
 */
Localization.prototype.getLocale = function (req) {
    return (req.session && req.session.locale) || this._defaultLocale;
};

/**
 * Return a locale map for the locale
 *
 * Format:
 *  {
 *      module1: {
 *          identifier: 'val'
 *      },
 *      module2: {
 *          identifier: 'val'
 *      }
 *  }
 *
 * @public
 * @static
 * @param module module name
 * @param locale
 */
Localization.prototype.getLocaleDefinitions = function (module, locale) {

    if (!module && !locale || locale && !this.isSupportedLocale(locale)) {
        return false;
    }

    if (!locale) {
        return this._translations.mod[module];
    }

    if (!module) {
        return this._translations.lng[locale];
    }

    return this._translations.lng[locale] &&
        this._translations.lng[locale][module];

};

/**
 * Load translations from the file
 *
 * @public
 * @static
 * @param module
 * @param lng
 * @param filePath
 */
Localization.prototype.load = function (module, lng, filePath) {
    this._log.trace('Load localizations for module: %s; file: %s; language: %s',
        module, filePath, lng);

    if (this._translations.mod[module] &&
        this._translations.mod[module][lng]) {
        return;
    }

    var moduleTranslations = {};

    // Load translation file
    try {
        moduleTranslations = require(filePath);
    } catch (e) {
        this._log.debug('Unable to load localizations for module: %s; file: %s; language: %s',
            module, filePath, lng);
        return;
    }

    if (!this._translations.mod[module]) {
        this._translations.mod[module] = {};
    }

    this._translations.mod[module][lng] = moduleTranslations;

    if (!this._translations.lng[lng]) {
        this._translations.lng[lng] = {};
    }

    this._translations.lng[lng][module] = moduleTranslations;

    this._log.debug('Localizations loaded for module: %s; file: %s; language: %s',
        module, filePath, lng);
};

/**
 * Middleware adapter for parsing current locale
 *
 * @public
 * @returns {Function}
 */
Localization.prototype.getLocaleParser = function () {
    var self = this;
    return function parseLocale(req, res, next) {
        req.log.trace('Parsing locale information from incoming request');

        // Find user locale from the cookie
        if (req.cookies.hasOwnProperty('locale')) {
            req.log.trace('Reading locale from language cookie');

            var locale = Localization._parseLocaleIdentifier(req.cookies.locale);
            if (self.isSupportedLocale(locale.group)) {
                req.log.trace('Locale found from language cookie; lang: %s',
                    locale.group);

                self.setLocale(req, locale.group);
                return next();
            }
        }

        // Do not try to parse accept language header when
        // language is already set in a session
        if (req.session && req.session.locale) {
            req.log.debug('Language is set, continue');
            return next();
        }

        // Find user locale from 'accept-language" header
        if (req.headers.hasOwnProperty('accept-language')) {
            req.log.trace('Reading locale from request language header');

            var locales = [];
            var acceptLanguage = req.headers['accept-language'];

            // Parse
            acceptLanguage.split(',').forEach(function (definition) {
                var userLocale = '';

                // Normalize
                if (definition.indexOf(';') !== -1) {
                    userLocale = definition.split(';')[0];
                } else {
                    userLocale = definition;
                }

                locales.push(Localization._parseLocaleIdentifier(userLocale));
            });

            // Pick first suitable language
            locales.some(function (locale) {
                // TODO: Region support
                var result = self.setLocale(req, locale.group);
                if (result) {
                    req.log.trace('Locale found from request language header;' +
                        'lang: %s', locale.group);
                }

                return result;
            });
            return next();
        } else {
            req.log.trace('Request did not contain any language related information');
            return next();
        }
    };
};

/**
 * Register middleware helpers
 *
 * @public
 * @returns {Function}
 */
Localization.prototype.getRegisterHelpers = function() {
    var self = this;
    return function registerLocalizationHelpers(req, res, next) {
        req.log.trace('Registering localization helpers');

        res.locals.localizer = self;
        //res.locals.translate = res.translate = self.translate.bind(self);

        return next();
    };
};

/**
 * Compile language definitions
 */
Localization.prototype.compile = function () {
    var self = this;

    this._log.debug('Compile localizations');

    Object.keys(self._translations.lng).forEach(function (lng) {
        var src = 'angular.extend(window.JP.get("lang"), { ' +
            '"locales": ' + JSON.stringify(self._locales) + ',' +
            '"defaultLocale": "' + self._defaultLocale + '",' +
            '"' + lng + '":' + JSON.stringify(self._translations.lng[lng]) +
            '});';

        var obj = {};
        obj['lng-' + lng] = src;
        self._compiled[lng] = obj;
    });

    this._log.debug('Localizations compiled');
};

/**
 * Get compiled language definitions
 *
 * @param req
 * @returns {Array}
 */
Localization.prototype.getCompiled = function (req) {
    var self = this;
    var lng = self.getLocale(req);

    if (!lng) {
        return {};
    }

    return self._compiled[lng] || {};
};

/**
 * Get compiled translations
 *
 * @param req
 * @returns {Array}
 */
Localization.prototype.getLanguage = function (req) {
    var self = this;
    var lng = self.getLocale(req);

    if (!lng) {
        return false;
    }

    return self._translations.lng[lng];
};

module.exports = Localization;
