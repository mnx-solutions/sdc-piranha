'use strict';

var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var util = require('util');
var path = require('path');

var logger = null;

var configuration = {
    locale: null, // Selected locale
    locales: [] // Enabled locales
};

var translations = {};

function Localization() {
}

Localization.conf = null;

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
}

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
 * Set default configuration options
 *
 * Options:
 *  - defaultLocale: default locale
 *  - locales: enabled locales
 *
 * @public
 * @static
 * @param opts
 */
Localization.configure = function (opts) {
    if (opts !== undefined) {
        if (opts.defaultLocale !== undefined) {
            configuration.locale = opts.defaultLocale;
        }

        if (opts.locales !== undefined && util.isArray(opts.locales)) {
            configuration.locales = opts.locales;
        }

        if (opts.log) {
            logger = opts.log;
        }

        Localization.conf = opts;
        logger.debug('Setting localization configuration: %o', configuration);
    }
};

/**
 * Check if a locale exists
 *
 * @public
 * @static
 * @param locale
 * @returns {boolean} true if locale is enabled, otherwise false
 */
Localization.isSupportedLocale = function (locale) {
    if (configuration.locales.indexOf(locale) !== -1) {
        return true;
    } else {
        return false;
    }
};

/**
 * Set current session locale
 *
 * @public
 * @static
 * @param req
 * @param locale
 * @param callback
 */
Localization.setLocale = function (req, locale, callback) {
    if (Localization.isSupportedLocale(locale)) {
        req.session.locale = locale;
        req.session.save();
    } else {
        if (callback) {
            callback(new Error('Unsupported locale "' + locale + '"'));
        }
    }
};

/**
 * Return current session locale
 *
 * @param req
 * @returns {string}
 */
Localization.getLocale = function (req) {
    return req.session.locale || configuration.locale;
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
 * @param callback
 */
Localization.getLocaleDefinitions = function (module, locale, callback) {
    if (typeof(callback) === 'undefined') {
        callback = locale;
        locale = module;
        module = null;
    }

    if (Localization.isSupportedLocale(locale)) {
        if (module) {
            if (!translations[module].hasOwnProperty(locale)) {
                return callback(new Error('Missing locale "' + locale +
                    '" for module "' + module + '"'));
            }

            var ret = {};
            ret[module] = translations[module][locale];

            return callback(null, ret);
        } else {
            var definitions = {};
            for (var module in translations) {
                if (!translations[module].hasOwnProperty(locale)) {
                    return callback(new Error('Missing locale "' + locale +
                        '" for module "' + module + '"'));
                }

                definitions[module] = translations[module][locale];
            }

            return callback(null, definitions);
        }
    } else {
        callback(new Error('Unsupported locale "' + locale + '"'));
    }
};

/**
 * Load translations from the file
 *
 * @public
 * @static
 * @param module
 * @param filePath
 * @param callback
 */
Localization.load = function (module, filePath, callback) {
    var moduleTranslations = {};

    // Load translation file
    try {
        moduleTranslations = require(filePath);
    } catch (e) {
        if (callback) {
            callback(e);
        }
        return;
    }

    // Resolve language
    if (moduleTranslations) {
        var locale = path.basename(filePath, path.extname(filePath));

        if (!translations.hasOwnProperty(module)) {
            translations[module] = {};
        }

        translations[module][locale] = moduleTranslations;
    }

    if (callback) {
        callback();
    }
};

/**
 * Translate input symbol
 *
 * @public
 * @static
 * @param identifier
 * @param params
 */
Localization.translate = function (identifier, params) {
    var locale = this.session.locale || configuration.locale;
    if (locale) {
        for (var module in translations) {
            if (translations[module].hasOwnProperty(locale)) {
                if (translations[module][locale].hasOwnProperty(identifier)) {
                    var translation = translations[module][locale][identifier];

                    if (typeof(translation) === 'string') {
                        return translations[module][locale][identifier];
                    } else if (typeof(translation) === 'object') {
                        if (translation.singular &&
                            translation.plural &&
                            translation.none) {

                            // Pluralize the string by first number occurrence
                            var pluralValue = null;
                            Object.keys(params).some(function (key) {
                               if (typeof(params[key]) === 'number') {
                                   pluralValue = params[key];
                                   return true;
                               }

                                return false;
                            });

                            if (pluralValue !== null) {
                                if (pluralValue <= 0) {
                                    return Localization._resolve(
                                        translation.none, params);
                                } else if (pluralValue === 1) {
                                    return Localization._resolve(
                                        translation.singular, params);
                                } else if (pluralValue > 1) {
                                    return Localization._resolve(
                                        translation.plural, params);
                                }
                            } else {
                                return translation;
                            }
                        } else {
                            return translation;
                        }

                        return translation;
                    }

                }
            }
        }
    } else {
        return '';
    }
};

/**
 * Middleware adapter for parsing current locale
 *
 * @public
 * @static
 * @param req
 * @param res
 * @param next
 * @returns {Function}
 */
Localization.localeParser = function (req, res, next) {
    return function parserMiddleware (req, res, next) {
        logger.debug('Parsing locale information from incoming request');

        // Find user locale from the cookie
        if (req.cookies.hasOwnProperty('locale')) {
            logger.debug('Reading locale from language cookie');

            var locale = Localization._parseLocaleIdentifier(req.cookies.locale);
            if (Localization.isSupportedLocale(locale.group)) {
                logger.debug('Locale found from language cookie; lang: %s',
                    locale.group);

                Localization.setLocale(req, locale.group);
                return next();
            }
        }

        // Do not try to parse accept language header when
        // language is already set in a session
        if (req.session.locale) {
            logger.debug('Language is set, continue');
            return next();
        }

        // Find user locale from 'accept-language" header
        if (req.headers.hasOwnProperty('accept-language')) {
            logger.debug('Reading locale from request language header');

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
                if (Localization.isSupportedLocale(locale.group)) {
                    logger.debug('Locale found from request language header;' +
                        'lang: %s', locale.group);

                    Localization.setLocale(req, locale.group);
                    return true;
                }

                return false;
            });

            return next();
        } else {
            logger.debug('Request did not contain any language related information');
            return next();
        }
    };
};

/**
 * Register middleware helpers
 *
 * @public
 * @static
 * @param req
 * @param res
 * @param next
 * @returns {Function}
 */
Localization.registerHelpers = function (req, res, next) {
    return function helpersnMiddleware (req, res, next) {
        logger.debug('Registering localization helpers');

        res.locals.localizer = Localization;
        res.locals.translate = res.translate = function () {
            return res.locals.localizer.translate.apply(req, arguments);
        };

        return next();
    };
};

module.exports = Localization;