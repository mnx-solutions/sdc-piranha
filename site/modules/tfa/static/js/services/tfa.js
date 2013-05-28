'use strict';


(function (ng, app) {
    app.factory('TFAService', [
        '$http',
        '$q',
        function ($http, $q) {
            var service = {};
            service.setup = function () {
                var defer = $q.defer();
                $http.get('tfa/setup')
                    .success(function (data) {
                        defer.resolve('<img src="' + data + '"></img>');
                    })
                    .error(function () {
                        //Unauthorized
                        defer.reject();
                    });
                return defer.promise;
            };

            service.setupTest = function (otpass) {
                var defer = $q.defer();
                $http.post('tfa/setup', {otpass:otpass})
                    .success(function (data) {
                        defer.resolve(data);
                    })
                    .error(function (){
                        //Unauthorized
                        defer.reject();
                    });
                return defer.promise;
            };

            service.login = function (otpass) {
                var defer = $q.defer();
                $http.post('tfa/login', {otpass:otpass})
                    .success(function (data) {
                        if(data.status === 'ok') {
                            window.location = data.redirect;
                            defer.resolve(data);
                        } else {
                            defer.reject(data);
                        }
                    })
                    .error(function (){
                        //Unauthorized
                        defer.reject();
                    });
                return defer.promise;
            };

            service.remove = function() {
                var defer = $q.defer();
                $http.get('tfa/remove')
                    .success(function (data) {
                        if(data.status === 'ok') {
                            defer.resolve(data);
                        } else {
                            defer.reject(data);
                        }
                    })
                    .error(function (err){
                        //Unauthorized
                        defer.reject(err);
                    });
                return defer.promise;
            };
            return service;
        }]);
}(window.angular, window.JP.getModule('TFA')));
