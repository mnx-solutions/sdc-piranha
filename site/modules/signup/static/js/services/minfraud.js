'use strict';

(function (app) {
    app.factory('MinFraud', [
        '$http',
        '$q',
        function ($http) {
            var service = {};
            var unavailableError = 'Service is unavailable';
            service.getRating = function (billingInfo, callback) {
                $http.post('maxmind/minfraud', billingInfo).success(function (resultObj) {
                    if (resultObj.success) {
                        callback(null, resultObj);
                    } else {
                        callback(resultObj.message);
                    }
                }).error(function (err) {
                    callback(err || unavailableError);
                });
            };
            return service;
        }]);
}(window.JP.getModule('Signup')));