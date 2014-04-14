'use strict';

// get the old hasban for returnUrl
window.JP.set('urlHashbang', window.location.hash);

(function (app) {
    app.controller('LandingPageController', [
        '$scope',
        '$window',
        'Landing',
        'localization',

        function ($scope, $window, Landing, localization) {
            localization.bind('landing', $scope);

            if ($scope.features.useBrandingOrange === 'enabled') {
                $window.location.href = '/landing/login';
            } else {
                $scope.loaded = true;
            }

            var oldHashbang = window.JP.get('urlHashbang');
            if(oldHashbang === '#!/' || !oldHashbang || oldHashbang === '') {
                oldHashbang = '#!/dashboard';
            }

            $scope.login = function() {
                var urlOpts = {
                    'method': 'login',
                    'redirectUrl': '/main/'+ oldHashbang
                };

                // redirect to login url
                $scope.redirectToSSO(urlOpts);
            };

            $scope.signup = function() {
                var urlOpts = {
                    'method': 'signup',
                    'redirectUrl': '/main/'+ oldHashbang
                };

                // redirect to signup url
                $scope.redirectToSSO(urlOpts);
            };

            $scope.passreset = function() {
                var urlOpts = {
                    'method': 'resetpassword',
                    'redirectUrl': '/'
                };

                // redirect to password reset
                $scope.redirectToSSO(urlOpts);
            };

            $scope.redirectToSSO = function(urlOpts) {
                // get url from our SSOurl endpoint
                Landing.getSSOUrl(urlOpts, function(data) {
                    $window.location.href = data.url;
                });
            };
        }]);
}(window.JP.getModule('Landing')));