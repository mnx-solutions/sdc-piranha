'use strict';

(function (app) {
    app.controller(
            'LoginFormController',
//		['$scope', '$http', 'Login', '$window',
//		function ($scope, $http, Login, $window) {
            ['$scope', 'Login', '$window', function ($scope, Login, $window) {
                    $scope.login = {
                        email: '',
                        password: '',
                        remember: ''
                    };

                    $scope.logIn = function () {
                        Login.try($scope.login, function (result) {
                            if (result.success) {
                                $window.location.href = '/app#!/machine';
                            }
                        });
                    };
                }]);
}(window.JP.getModule('Login')));
