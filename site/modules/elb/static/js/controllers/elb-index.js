'use strict';

(function (app) {
    app.controller(
        'elb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'elb.Service', 'Datacenter', 'notification',
                function ($scope, requestContext, localization, $location, service, Datacenter, notification) {
                localization.bind('elb', $scope);
                requestContext.setUpRenderContext('elb.index', $scope, {
                    title: localization.translate(null, 'elb', 'Enable Load Balancing')
                });

                $scope.allLoading = false;

                service.getController().then(function () {
                    $location.path('/elb/list');
                }, function () {
                    $scope.allLoading = true;
                });

                $scope.enableElb = function () {
                    $scope.allLoading = false;
                    service.createController().then(function () {
                        $location.path('/elb/list');
                    }, function (err) {
                        notification.replace('elb', { type: 'error' }, err);
                        $scope.allLoading = true;
                    });
                };

                $scope.licenseAcceptCheck = false;
                $scope.licenseAccept = function () {
                    $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
                };

            }]
    );
}(window.JP.getModule('elb')));
