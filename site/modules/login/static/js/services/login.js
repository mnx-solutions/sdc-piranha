'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Login', ['$http', function ($http) {
            return {
                try: function (credentials, success) {
                    $http.post('/login', credentials).success(success);
                }
            };
        }]);
}(window.JP.getModule('Login')));