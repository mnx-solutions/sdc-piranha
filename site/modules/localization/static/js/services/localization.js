'use strict';

(function (app) {
    app.factory('localization', [ '$locale', '$cookies', '$rootScope', '$http',
        function ($locale, $cookies, $rootScope, $http) {

            var locales = [];
            var contexts = [];
            var translations = {};

            var service = {
                /**
                 * Normalize locale string (en-us -> en)
                 *
                 * @private
                 * @param locale
                 * @returns {string} locale
                 */
                _normalize: function (locale) {
                    // FIXME: Do not ignore region
                    if (locale.indexOf('-') !== -1) {
                        locale = locale.split('-')[0];
                    }

                    return locale;
                },

                /**
                 * Load translations
                 *
                 * @private
                 * @param done
                 */
                _load: function (done) {
                    if(typeof done === 'function') {
                      $http.get('/localization/translations').success(function (data, status) {
                        translations = data;
                        console.log(data);
                        $rootScope.$broadcast('localization:change');
                        done();
                      });
                    } else {
                      translations = done;
                      $rootScope.$broadcast('localization:change');
                    }
                },

                /**
                 * Find matching module for the scope
                 *
                 * @private
                 * @param originScope origin scope for the registred module
                 * @returns {}
                 */
                _find: function (originScope) {
                    for (var i = 0, c = contexts.length; i < c; i++) {
                        var context = contexts[i];
                        var scope = context.scope;

                        while (scope) {
                            if (scope === originScope) {
                                break;
                            }

                            scope = scope.$parent || null;
                        }

                        if (scope) {
                            return context.module;
                        }
                    }
                },

                /**
                 * Initialize localization service
                 *
                 * @private
                 * @param done
                 */
                _init: function (done) {
                    if (typeof done === 'function') {
                        $http.get('/localization/locales').success(function (data, status) {
                            locales = data;
                            done();
                        });
                    } else {
                        locales = done;
                    }
                },

                /**
                 * Detect if locale is supported or not
                 *
                 * @param locale
                 * @returns {boolean}
                 */
                isSupportedLocale: function (locale) {
                    if (locales.indexOf(this._normalize(locale)) !== -1) {
                        return true;
                    } else {
                        return false;
                    }
                },

                /**
                 * Set current locale
                 *
                 * @param locale
                 */
                setLocale: function (locale) {
                    $cookies.locale = this._normalize(locale);
                    $rootScope.$broadcast('localization:change');
                },

                /**
                 * Get current locale
                 *
                 * @returns {string}
                 */
                getLocale: function () {
                    return $cookies.locale;
                },

                /**
                 * Bind scope to a module context
                 *
                 * @param module
                 * @param scope
                 */
                bind: function (module, scope) {
                    if (!contexts.hasOwnProperty(module)) {
                        contexts.push({
                            scope: scope,
                            module: module
                        });
                    }
                },

                /**
                 * Translate input string
                 *
                 * @param scope origin scope
                 * @param identifier translation identifier
                 * @param count count value (pluralization)
                 * @returns {string}
                 */
                translate: function (scope, identifier, count) {
                    var module = this._find(scope);
                    if (translations.hasOwnProperty(module)) {
                        var table = translations[module];

                        if (table.hasOwnProperty(identifier)) {
                            var translation = table[identifier];

                            if (typeof(translation) === 'string') {
                                return translation;
                            } else if (typeof(translation) === 'object') {
                                if (translation.singular &&
                                    translation.plural &&
                                    translation.none) {

                                    if (count !== undefined) {
                                        if (count <= 0) {
                                            return translation.none;
                                        } else if (count === 1) {
                                            return translation.singular;
                                        } else if (count > 1) {
                                            return translation.plural;
                                        }
                                    } else {
                                        return translation.plural;
                                    }
                                } else {
                                    return translation;
                                }

                                return translation;
                            }
                        }
                    }
                }
            };

            // Set locale if not set
            if (!service.getLocale()) {
                service.setLocale($locale.id);
            }
            var lang = window.JP.get('lang');
            service._init(lang.locales); // Init
            service._load(lang[service.getLocale()]);

            service.translations = translations;
            return service;
    }]);

}(window.JP.getModule('localization')));
