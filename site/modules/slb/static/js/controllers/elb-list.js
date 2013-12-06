'use strict';

(function (app) {
    app.controller(
        'slb.ListController',
        ['$scope', 'requestContext', 'localization', 'slb.Service', '$location',
            'notification', 'util',
                function ($scope, requestContext, localization, service,
                    $location, notification, util) {

                $scope.listLoaded = false;
                localization.bind('slb', $scope);
                requestContext.setUpRenderContext('slb.list', $scope, {
                    title: localization.translate(null, 'slb', 'Load Balancers List')
                });

                $scope.disableLb = function () {
                    util.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: Uninstall Load Balancer'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'All load balancers will be deleted. This cannot be undone.'
                        ), function () {
                            $scope.listLoaded = false;
                            $scope.deleting = true;
                            service.deleteController().then(function () {
                                $location.path('/slb');
                            }, function () {
                                $scope.deleting = false;
                                $scope.listLoaded = true;
                            });
                        });
                };

                $scope.servers = [];

                service.getController().then(function () {
                    service.getBalancers().then(function (data) {
                        $scope.servers = data;
                        $scope.listLoaded = true;
                    }, function (err) {
                        if (!$scope.deleting) {
                            notification.replace('slb', { type: 'error' }, err);
                        }
                    });
                }, function () {
                    $location.path('/slb');
                });
            }]
    );
}(window.JP.getModule('slb')));
