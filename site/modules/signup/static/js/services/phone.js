'use strict';

(function (app) {
    app.factory('Phone', [
        '$http',
        '$q',
        function ($http) {
            var service = {};
            service.getCountries = function () {
                return $http.get('account/countryCodes');
            };
            service.makeCall = function(phone) {
                return $http.get('/signup/signup/maxmind/call/%2B' + phone);
            };
            service.verify = function (pin) {
                return $http.get('/signup/signup/maxmind/verify/' + pin);
            };
            return service;
        }]);
}(window.JP.getModule('Signup')));