'use strict';

(function (app) {
    app.controller(
        'elb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'elb.Service',
                function ($scope, requestContext, localization, $location, service) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.index', $scope, {
                title: localization.translate(null, 'elb', 'Enable Load Balancing')
            });

            $scope.allLoading = false;

            service.getController().then(function (isEnabled) {
                if (isEnabled) {
                    $location.path('/elb/list');
                }
                $scope.allLoading = true;
            })

            $scope.enableElb = function () {
                service.createController().then(function () {
                    $location.path('/elb/list');
                });
            };

            $scope.licenseAcceptCheck = false;
            $scope.licenseAccept = function(){
                $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
            }

        }]);
}(window.JP.getModule('elb')));
