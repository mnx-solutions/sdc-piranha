'use strict';

(function (app) {
    app.controller(
        'LandingPageController',
        ['$scope', '$window', 'Landing', function ($scope, $window, Landing) {
            $scope.login = function() {
                var urlOpts = {
                    'method': 'login',
                    'redirectUrl': '/main/#!/machine'
                }

                // redirect to login url
                $scope.redirectToSSO(urlOpts);
            };

            $scope.signup = function() {
                var urlOpts = {
                    'method': 'signup',
                    'redirectUrl': '/main/#!/machine'
                }

                // redirect to signup url
                $scope.redirectToSSO(urlOpts);
            }

            $scope.passreset = function() {
                var urlOpts = {
                    'method': 'resetpassword',
                    'redirectUrl': '/'
                }

                // redirect to password reset
                $scope.redirectToSSO(urlOpts);
            }

            $scope.redirectToSSO = function(urlOpts) {
                // get url from our SSOurl endpoint
                Landing.getSSOUrl(urlOpts, function(data) {
                    $window.location.href = data.url;
                })
            }
        }]);
}(window.JP.getModule('Landing')));