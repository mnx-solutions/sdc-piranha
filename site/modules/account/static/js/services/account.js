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
    app.factory('Account', ['$http','$q', 'serverTab', '$$track', function ($http, $q, serverTab, $$track) {
        var service = {};

        var account = null;

        /**
         * @ngdoc
         * @name account.service:account#getAccount
         * @methodOf account.service:account
         * @description
         * Get an account
         *
         * @returns {Deferred} Returns a new instance of deferred.
         */
        service.getAccount = function(noCache) {
            if(!noCache)
              noCache = false;

            var deferred = $q.defer();

            if(!account) {
                serverTab.call({
                    name: 'getAccount',
                    data: {noCache: noCache},
                    progress: function(err, job) {
                    },
                    done: function(err, job) {
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
        service.updateAccount = function(data) {
            var deferred = $q.defer();

            serverTab.call({
                name: 'updateAccount',
                data: (data.$$v || data),
                progress: function(err, job) {
                },
                done: function(err, job) {
                    var resolver = job.__read();
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
        service.createKey = function(name, keyData) {
            var deferred = $q.defer();

            serverTab.call({
                name: 'createKey',
                data: {name: name, key: keyData},
                progress: function(err, job) {
                    console.log('Error on progress', err);
                    if(err) {
                        deferred.resolve(err);
                    }
                },
                done: function(err, job) {
                    if(err) {
                        deferred.resolve(err);
                    } else {
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
        service.getKeys = function(noCache) {
            if(!noCache)
                noCache = false;

            var deferred = $q.defer();

            serverTab.call({
                name: 'listKeys',
                data: {noCache: noCache},
                progress: function(err, job) {
                },
                done: function(err, job) {
                    deferred.resolve(job.__read());
                }

            });

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
        service.deleteKey = function(fingerprint) {
            var deferred = $q.defer();
            serverTab.call({
                name: 'deleteKey',
                data: {fingerprint: fingerprint},
                progress: function(err, job) {

                },
                done: function(err, job) {
                    deferred.resolve(job.__read());
                }
            });

            return deferred;
        };

        return service;
    }]);
}(window.JP.getModule('Account')));