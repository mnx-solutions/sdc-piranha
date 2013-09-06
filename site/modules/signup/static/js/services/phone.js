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
                //FIXME: Must use relative URL's, so modules could be used under different apps
                return $http.get('/signup/signup/maxmind/call/%2B' + phone);
            };
            service.verify = function (pin) {
                return $http.get('/signup/signup/maxmind/verify/' + pin);
            };
            return service;
        }]);
}(window.JP.getModule('Signup')));