'use strict';

(function (app) {
    app.factory('Phone', [
        '$http',
        '$q',
        function ($http) {
            var service = {};
            var unavailableError = 'Service is unavailable';
            service.getCountries = function (callback) {
                return $http.get('account/countryCodes').success(function (countries) {
                    callback(null, countries);
                }).error(function (err) {
                    callback(err || unavailableError);
                });
            };
            service.makeCall = function (phone, callback) {
                return $http.get('maxmind/call/%2B' + phone + '?rnd=' + Math.random().toString(36).substr(2)).success(function (resultObj) {
                    if (resultObj.success) {
                        callback(null, resultObj);
                    } else {
                        callback(resultObj.message, resultObj);
                    }
                }).error(function (err) {
                    callback(err || unavailableError);
                });
            };
            service.verify = function (pin, callback) {
                return $http.get('maxmind/verify/' + pin + '?rnd=' + Math.random().toString(36).substr(2)).success(function (resultObj) {
                    if (resultObj.success) {
                        callback(null, resultObj);
                    } else {
                        callback(resultObj.message, resultObj);
                    }
                }).error(function (err) {
                    callback(err  || unavailableError);
                });
            };
            return service;
        }]);
}(window.JP.getModule('Signup')));