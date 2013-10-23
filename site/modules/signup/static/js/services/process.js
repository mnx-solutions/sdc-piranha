'use strict';

(function (app) {
    app.factory('Process', [
        '$http',
        '$q',
        function ($http) {
            var service = {};
            var unavailableError = 'Service is unavailable';
            service.getPreviousStep = function (callback) {
                $http.get('signup/currentStep').success(function (step) {
                    callback(null, step);
                }).error(function (err) {
                    callback(err || unavailableError);
                });
            };
            service.getAttemptId = function (callback) {
                $http.get('signup/attemptId').success(function (attemptId) {
                    callback(null, attemptId);
                }).error(function (err) {
                    callback(err || unavailableError);
                });
            };
            return service;
        }]);
}(window.JP.getModule('Signup')));