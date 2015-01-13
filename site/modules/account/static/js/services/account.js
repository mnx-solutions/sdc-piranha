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
        '$q',
        'serverTab',
        '$$track',
        'PopupDialog',
        '$rootScope',
        function ($q, serverTab, $$track, PopupDialog, $rootScope) {
            var service = {};

            var account = null;
            var parentAccount = null;
            var accountPromise = null;
            var parentAccountPromise = null;
            var keys = null;

            var features = window.JP.get('features');

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
                    window.localStorage.lastAccountId = accountId;
                    setInterval(function () {
                        if (lastAccountId !== window.localStorage.lastAccountId) {
                            window.location.reload();
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
                    if (!accountPromise || !accountPromise.pending) {
                        accountPromise = {};
                        accountPromise.deferred = deferred;
                        accountPromise.pending = true;
                    } else {
                        accountPromise.deferred.promise.then(deferred.resolve, deferred.reject);
                        return deferred.promise;
                    }

                    serverTab.call({
                        name: 'getAccount',
                        data: {
                            noCache: noCache
                        },
                        done: function (err, job) {
                            accountPromise.pending = false;
                            if (err) {
                                deferred.reject(err);
                                return;
                            }
                            account = job.__read();
                            service.setCurrentUserId(account.id);
                            $rootScope.provisionEnabled = account.provisionEnabled || false;
                            deferred.resolve(account);
                            if (features.marketo === 'enabled') {
                                $$track.marketing_lead(account);
                            }
                        }
                    });
                } else {
                    deferred.resolve(account);
                }

                return deferred.promise;
            };

            service.getParentAccount = function (noCache) {
                if (!noCache) {
                    noCache = false;
                }

                var deferred = $q.defer();

                if (!parentAccount) {
                    if (!parentAccountPromise || !parentAccountPromise.pending) {
                        parentAccountPromise = {};
                        parentAccountPromise.deferred = deferred;
                        parentAccountPromise.pending = true;
                    } else {
                        parentAccountPromise.deferred.promise.then(deferred.resolve, deferred.reject);
                        return deferred.promise;
                    }

                    serverTab.call({
                        name: 'getParentAccount',
                        data: {
                            noCache: noCache
                        },
                        done: function (err, job) {
                            parentAccountPromise.pending = false;
                            if (err) {
                                deferred.reject(err);
                                return;
                            }
                            parentAccount = job.__read();
                            deferred.resolve(parentAccount);
                        }
                    });
                } else {
                    deferred.resolve(parentAccount);
                }

                return deferred.promise;
            };


            if (features.zendesk === 'enabled') {
                var zenboxInit = function (name) {
                    if (typeof(window.Zenbox) !== "undefined" && $rootScope.zenboxParams.dropboxID) {
                        $rootScope.zenboxParams.requester_name = name;
                        window.Zenbox.init($rootScope.zenboxParams);
                        window.angular.element("#zenbox_tab").click(function () {
                            if (typeof(window._gaq) !== "undefined") {
                                window._gaq.push(["_trackEvent", "Window Open", "Zenbox Support"]);
                            }
                        });
                    }
                };

                service.getAccount().then(function (account) {
                    $rootScope.zenboxParams.requester_email = account.email;
                    if (account.isSubuser) {
                        service.getParentAccount().then(function (parentAccount) {
                            zenboxInit(parentAccount.login + '/' + account.login);
                        });
                    } else {
                        zenboxInit(account.login);
                    }
                });
            }

            service.checkProvisioning = function (submitBillingInfo, cbEnabled, cbDisabled, locationCb, showPopUp) {
                var defaultCb = angular.noop;
                cbEnabled = cbEnabled || defaultCb;
                cbDisabled = cbDisabled || defaultCb;
                service.getAccount().then(function (provisionAccount) {
                    if (!provisionAccount.provisionEnabled) {
                        PopupDialog.errorProvision(submitBillingInfo, locationCb, showPopUp);
                        cbDisabled();
                    } else {
                        cbEnabled();
                    }
                });
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
                        if (features.marketo === 'enabled') {
                            $$track.marketing_lead(account);
                        }
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
                    progress: function (err) {
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

            service.userConfig = null;
            service.getUserConfig = function () {
                function load(callback) {
                    service.getAccount().then(function (provisionAccount) {
                        if (provisionAccount.provisionEnabled) {
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
                        } else {
                            callback(null, {});
                        }
                    });
                }

                function UserConfig(config, parent) {
                    if (!parent && service.userConfig) {
                        return service.userConfig;
                    }
                    if (!(this instanceof UserConfig)) {
                        return new UserConfig(config, parent);
                    }

                    service.userConfig = this;
                    angular.extend(this, config);
                    this._parent = parent || service.userConfig;
                    this._dirty = false;
                    return this;
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

                return new UserConfig({});
            };

            service.setUserConfig = function (config) {
                var deferred = $q.defer();
                service.getAccount().then(function (provisionAccount) {
                    if (provisionAccount.provisionEnabled) {
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
                    } else {
                        deferred.resolve();
                    }
                }, function (err) {
                    deferred.reject(err);
                });

                return deferred.promise;
            };

            return service;
        }]);
}(window.JP.getModule('Account')));