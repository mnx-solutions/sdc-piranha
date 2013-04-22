'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Account', ['$http','$q', 'serverTab', '$$track', function ($http, $q, serverTab, $$track) {
        var service = {};

        var account = null;
        service.getAccount = function() {
            var deferred = $q.defer();

            if(!account) {
                serverTab.call({
                    name: 'getAccount',
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

        service.updateAccount = function(data) {
            var deferred = $q.defer();

            serverTab.call({
                name: 'updateAccount',
                data: data.$$v,
                progress: function(err, job) {
                },
                done: function(err, job) {
                    var resolver = job.__read();
                    deferred.resolve(resolver);
                }
            });

            return deferred.promise;
        };

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