'use strict';

(function (ng, app) {
    app.controller(
        'LoginFormController',
        function ($scope, $http, Login, $window) {
            $scope.login = {
                email:'',
                password:'',
                remember:''
            };

            $scope.logIn = function () {
                Login($scope.login, function (result) {
                    if (result.success) {
                        $window.location.href = '/app#!/machine';
                    }
                });
            };
        });
})(window.angular, window.LoginModule);
