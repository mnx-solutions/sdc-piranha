'use strict';

(function (app) {
    app.controller(
        'LandingPageController',
        ['$scope', '$window', 'Landing', function ($scope, $window, Landing) {
            $scope.login = function() {
                var urlOpts = {
                    'method': 'login',
                    'redirectUrl': '/main/'
                }
                // get login url
                Landing.getLoginUrl(urlOpts, function(data) {
                    // redirect user to the login page retrieved from /ssourl
                    $window.location.href = data.url;
                })
            };

            $scope.signup = function() {
                var urlOpts = {
                    'method': 'signup',
                    'redirectUrl': '/'
                }

                // get signup url
                Landing.getSignupUrl(urlOpts, function(data) {
                    // redirect user to the signup page
                    $window.location.href = data.url;
                })
            }
        }]);
}(window.JP.getModule('Landing')));