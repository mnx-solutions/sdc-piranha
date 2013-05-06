'use strict';

(function (app) {
    app.controller(
            'LoginFormController',
            ['$scope', 'Login', '$window', function ($scope, Login, $window) {
                    $scope.login = {
                        email: '',
                        password: '',
                        remember: ''
                    };

                    $scope.logIn = function () {
                        Login.try($scope.login, function (result) {
                            if (result.success) {
                                $window.location.href = '/#!/dashboard';
                            }
                        });
                    };
                }]);
}(window.JP.getModule('Login')));
