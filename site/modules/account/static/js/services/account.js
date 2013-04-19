'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Account', ['$http','$q', 'serverTab', function ($http, $q, serverTab) {
        var service = {};

        var account = {};
        service.getAccount = function() {
            var deferred = $q.defer();

            serverTab.call({
                name: 'getAccount',
                progress: function(err, job) {
                },
                done: function(err, job) {
                    deferred.resolve(job.__read());
                }
            })

            return deferred.promise;
        }

        service.createKey = function(name, keyData) {
            var deferred = $q.defer();

            serverTab.call({
                name: 'createKey',
                data: {'name': name, 'key': keyData},
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
            })

            return deferred.promise;
        }

        service.getKeys = function() {
            var deferred = $q.defer();

            serverTab.call({
                name: 'listKeys',
                progress: function(err, job) {
                },
                done: function(err, job) {
                    deferred.resolve(job.__read());
                }

            })

            return deferred.promise;
        }

        return service;
    }]);
}(window.JP.getModule('Account')));