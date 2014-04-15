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
             * Check if user from other tab was logged in with alternate login and if it is so, refresh the page
             *
             * Check is based on the fact that localStorage is shared for current domain between all browser tabs
             * while lastAccountId variable is tied to current client application instance. If they become different,
             * that means that new user logged in on other tab.
             */
            var lastAccountId = null;
            service.setCurrentUserId = function (accountId) {
                if (!lastAccountId) {
                    lastAccountId = accountId;
                    localStorage.lastAccountId = accountId;
                    setInterval(function () {
                        if (lastAccountId !== localStorage.lastAccountId) {
                            location.reload();
                        }
                    }, 1000);
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
                            service.setCurrentUserId(account.id);
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

                function UserConfig(config, parent) {
                    if (!(this instanceof UserConfig)) {
                        return new UserConfig(config, parent);
                    }

                    angular.extend(this, config);
                    this._parent = parent || this;
                    this._dirty = false;
                }
                UserConfig.prototype.dirty = function (value) {
                    if (Boolean(value) === value) {
                        this._parent._dirty = value;
                    }
                    return this._parent._dirty;
                };
                UserConfig.prototype.$save = function () {
                    if (this.dirty()) {
                        service.setUserConfig(this._parent);
                        this.dirty(false);
                    }
                };
                UserConfig.prototype.loaded = function () {
                    return this._parent._loaded;
                };
                UserConfig.prototype.$load = function (callback) {
                    var self = this;
                    if (this.loaded()) {
                        callback(null, this);
                    } else {
                        load(function (err, cfg) {
                            angular.extend(self._parent, cfg);
                            self._parent._loaded = true;
                            callback(err, self._child ? self._parent.$child(self._child) : self);
                        });
                    }
                };

                UserConfig.prototype.$child = function (name) {
                    if (this._child) {
                        return this._parent.$child(name);
                    }
                    var config = this._parent[name] || {};
                    if (config instanceof UserConfig) {
                        return config;
                    }
                    this._parent[name] = new UserConfig(config, this);
                    this._parent[name]._child = name;
                    return this._parent[name];
                };

                UserConfig.prototype.toJSON = function () {
                    var config = {};
                    var k;
                    for (k in this) {
                        if (this.hasOwnProperty(k) && k[0] !== '_') {
                            config[k] = this[k];
                        }
                    }
                    return config;
                };

                return new UserConfig(service.userConfig);
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