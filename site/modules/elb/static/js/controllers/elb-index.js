'use strict';

(function (app) {
    app.controller(
        'elb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'elb.Service', 'Datacenter',
                function ($scope, requestContext, localization, $location, service, Datacenter) {
                localization.bind('elb', $scope);
                requestContext.setUpRenderContext('elb.index', $scope, {
                    title: localization.translate(null, 'elb', 'Enable Load Balancing')
                });

                $scope.datacenters = Datacenter.datacenter();
                $scope.datacenters.then(function (datacenters) {
                    if (datacenters.length > 0) {
                        $scope.datacenter = datacenters[0];
                    }
                });

                $scope.allLoading = false;

                service.getController().then(function () {
                    $location.path('/elb/list');
                }, function () {
                    $scope.allLoading = true;
                });

                $scope.enableElb = function () {
                    $scope.allLoading = false;
                    service.createController($scope.datacenter.name).then(function () {
                        $location.path('/elb/list');
                    }, function (err) {
                        console.log(err);
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
