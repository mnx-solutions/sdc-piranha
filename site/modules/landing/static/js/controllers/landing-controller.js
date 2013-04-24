'use strict';

// get the old hasban for returnUrl
window.JP.set('urlHashbang', window.location.hash);

(function (app) {
    app.controller(
        'LandingPageController',
        ['$scope', '$window', 'Landing', 'localization', function ($scope, $window, Landing, localization) {
            localization.bind('landing', $scope);

            var oldHashbang = window.JP.get('urlHashbang');

            if(oldHashbang == '#!/' || !oldHashbang || oldHashbang == '') {
                oldHashbang = '#!/machine';
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
					/*
						To make SSO popup
					*/
					var Params = {
						'width':550,
						'height':450,
						'left':(screen.width/2)-(550/2),
						'top':(screen.height*0.2)
					};
					// $window.open(data.url,'dialogue','width='+Params.width+',height='+Params.height+',left='+Params.left+',top='+Params.top+',status=0,toolbar=0,location=0,menubar=0,directories=0,scrollbars=0');
                });
            };
        }]);
}(window.JP.getModule('Landing')));