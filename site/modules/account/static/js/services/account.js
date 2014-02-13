'use strict';

(function (app) {
    /**
     * @ngdoc service
     * @name account.service:account
     *
     * @requires angular.$rootScope
     * @requires angular.$q
     * @requires serverTab
     * @requires $$track
     *
     * @description
     * Account module
     */
    app.factory('Account', [
        '$http',
        '$q',
        'serverTab',
        '$$track',
        function ($http, $q, serverTab, $$track) {
            var service = {};

            var account = null;
            var keys = null;

            /**
             * @ngdoc
             * @name account.service:account#setTfaCache
             * @methodOf account.service:account
             * @description
             * Set tfaEnabled flag in account cache
             *
             * @returns undefined
             */
            service.setTfaCache = function (tfaFlag) {
                if (account) {
                    account.tfaEnabled = tfaFlag;
                }
            };

            /**
             * @ngdoc
             * @name account.service:account#getAccount
             * @methodOf account.service:account
             * @description
             * Get an account
             *
             * @returns {Deferred} Returns a new instance of deferred.
             */
            service.getAccount = function (noCache) {
                if (!noCache) {
                    noCache = false;
                }

                var deferred = $q.defer();

                if (!account) {
                    serverTab.call({
                        name: 'getAccount',
                        data: {
                            noCache: noCache
                        },
                        done: function (err, job) {
                            if (err) {
                                deferred.reject(err);
                                return;
                            }
                            account = job.__read();
                            deferred.resolve(account);
                            $$track.marketing_lead(account);
                        }
                    });
                } else {
                    deferred.resolve(account);
                }

                return deferred.promise;
            };

            /**
             * @ngdoc
             * @name account.service:account#updateAccount
             * @methodOf account.service:account
             * @description
             * Update an account
             *
             * @returns {Deferred} Returns a new instance of deferred.
             */
            service.updateAccount = function (data) {
                var deferred = $q.defer();

                serverTab.call({
                    name: 'updateAccount',
                    data: (data.$$v || data),
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var resolver = job.__read();
                        account = resolver;
                        deferred.resolve(resolver);
                        $$track.marketing_lead(account);
                    }
                });

                return deferred.promise;
            };

            /**
             * @ngdoc
             * @name account.service:account#createKey
             * @methodOf account.service:account
             * @description
             * Create a new SSH key
             *
             * @returns {Deferred} Returns a new instance of deferred.
             */
            service.createKey = function (name, keyData) {
                var deferred = $q.defer();

                serverTab.call({
                    name: 'createKey',
                    data: {
                        name: name,
                        key: keyData
                    },
                    progress: function (err, job) {
                        if (err) {
                            keys = null;
                            deferred.resolve(err);
                        }
                    },
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            keys = null;
                            deferred.resolve(job.__read());
                        }
                    }
                });

                return deferred.promise;
            };

            /**
             * @ngdoc
             * @name account.service:account#getKeys
             * @methodOf account.service:account
             * @description
             * Get account keys
             *
             * @returns {Deferred} Returns a new instance of deferred.
             */
            service.getKeys = function (noCache) {
                if (!noCache) {
                    noCache = false;
                }

                var deferred = $q.defer();

                if (!keys || noCache) {
                    serverTab.call({
                        name: 'listKeys',
                        data: {
                            noCache: noCache
                        },
                        done: function (err, job) {
                            if (err) {
                                deferred.reject(err);
                                return;
                            }
                            keys = job.__read();
                            deferred.resolve(keys);
                        }

                    });
                } else {
                    deferred.resolve(keys);
                }

                return deferred.promise;
            };

            /**
             * @ngdoc
             * @name account.service:account#deleteKey
             * @methodOf account.service:account
             * @description
             * Delete account key
             *
             * @returns {Deferred} Returns a new instance of deferred.
             */
            service.deleteKey = function (fingerprint) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'deleteKey',
                    data: {
                        fingerprint: fingerprint
                    },
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        keys = null;
                        deferred.resolve(job.__read());
                    }
                });

                return deferred.promise;
            };

            service.userConfig = {};
            service.getUserConfig = function () {
                function load(callback) {
                    serverTab.call({
                        name: 'GetUserConfig',
                        data: {},
                        done: function (err, job) {
                            if (err) {
                                callback(err, {});
                                return;
                            }
                            callback(null, job.__read());
                        }
                    });
                }

                function createConfig(config, loaded) {
                    config.__proto__ = {
                        _dirty: false,
                        set dirty(val) {
                            if (this.parent) {
                                this.parent._dirty = !!val;
                            } else {
                                this._dirty = !!val;
                            }
                        },
                        get dirty() {
                            return this.parent ? this.parent._dirty : this._dirty;
                        },
                        child: null,
                        loaded: config.loaded !== undefined ? config.loaded : !!loaded,
                        $save: function () {
                            if (!this.dirty) {
                                return;
                            } else {
                                this.dirty = false;
                            }
                            return service.setUserConfig(config.parent || config);
                        },
                        $load: function (callback) {
                            function ret(err, cfg) {
                                var child = config.child;
                                cfg = createConfig(cfg, !err);
                                if (child) {
                                    cfg = config.$child(child);
                                }
                                return cfg;
                            }
                            if (this.loaded) {
                                callback(null, ret(null, this));
                            } else {
                                load(function (err, cfg) {
                                    angular.extend(config.parent || config, cfg);
                                    callback(err, ret(err, cfg));
                                });
                            }
                        },
                        $child: function (name) {
                            if (this.child) {
                                return this.parent.$child(name);
                            }
                            this[name] = this[name] || {};
                            this[name] = createConfig(this[name]);
                            this[name].__proto__.child = name;
                            this[name].__proto__.parent = this;
                            return this[name];
                        }
                    };
                    return config;
                }
                return createConfig(service.userConfig);
            };

            service.setUserConfig = function (config) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'SetUserConfig',
                    data: config,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        deferred.resolve(job.__read());
                    }
                });

                return deferred.promise;
            };

            return service;
        }]);
}(window.JP.getModule('Account')));