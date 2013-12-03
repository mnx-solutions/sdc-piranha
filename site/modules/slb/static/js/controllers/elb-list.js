'use strict';

(function (app) {
    app.controller(
        'slb.ListController',
        ['$scope', 'requestContext', 'localization', 'slb.Service', '$location', 'notification',
                function ($scope, requestContext, localization, service, $location, notification) {
                $scope.listLoaded = false;
                localization.bind('slb', $scope);
                requestContext.setUpRenderContext('slb.list', $scope, {
                    title: localization.translate(null, 'slb', 'Load Balancers List')
                });

                $scope.disableLb = function () {
                    $scope.listLoaded = false;
                    service.deleteController().then(function () {
                        $location.path('/slb');
                    }, function (err) {
                        $scope.listLoaded = true;
                    });
                };

                $scope.servers = [];

                service.getController().then(function () {
                    service.getBalancers().then(function (data) {
                        $scope.servers = data;
                        $scope.listLoaded = true;
                    }, function (err) {
                        notification.replace('slb', { type: 'error' }, err);
                    });
                }, function () {
                    $location.path('/slb');
                });

                $scope.createNew = function createNew() {
                    $location.path('/elb/edit/');
                };
            }]
    );
}(window.JP.getModule('slb')));
