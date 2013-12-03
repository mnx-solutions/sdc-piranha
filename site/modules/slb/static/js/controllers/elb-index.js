'use strict';

(function (app) {
    app.controller(
        'slb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'slb.Service', 'Datacenter', 'notification',
                function ($scope, requestContext, localization, $location, service, Datacenter, notification) {
                localization.bind('slb', $scope);
                requestContext.setUpRenderContext('slb.index', $scope, {
                    title: localization.translate(null, 'slb', 'Enable Load Balancing')
                });

                $scope.loaded = false;
                $scope.creating = false;

                service.getController().then(function () {
                    $location.path('/slb/list');
                }, function () {
                    $scope.loaded = true;
                });

                $scope.enableSlb = function () {
                    $scope.creating = true;
                    service.createController().then(function () {
                        $location.path('/slb/list');
                    }, function (err) {
                        notification.replace('slb', { type: 'error' }, err);
                        $scope.creating = false;
                    });
                };

                $scope.licenseAcceptCheck = false;
                $scope.licenseAccept = function () {
                    $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
                };

            }]
    );
}(window.JP.getModule('slb')));
