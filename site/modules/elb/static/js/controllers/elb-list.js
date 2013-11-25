'use strict';

(function (app) {
    app.controller(
        'elb.ListController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', '$location', 'notification',
                function ($scope, requestContext, localization, service, $location, notification) {
                $scope.listLoaded = false;
                localization.bind('elb', $scope);
                requestContext.setUpRenderContext('elb.list', $scope, {
                    title: localization.translate(null, 'elb', 'Load Balancers List')
                });

                $scope.disableLb = function () {
                    $scope.listLoaded = false;
                    service.deleteController().then(function () {
                        $location.path('/elb');
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
                        notification.replace('elb', { type: 'error' }, err);
                    });
                }, function () {
                    $location.path('/elb');
                });
            }]
    );
}(window.JP.getModule('elb')));
