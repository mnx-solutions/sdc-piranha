'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Landing', ['$http', function ($http) {
        return {
            getLoginUrl: function (urlOpts, success) {
                $http.post('/landing/ssourl', urlOpts).success(success);
            },
            getSignupUrl: function(urlOpts, success) {
                $http.post('/landing/ssourl', urlOpts).success(success);
            }
        };
    }]);
}(window.JP.getModule('Landing')));