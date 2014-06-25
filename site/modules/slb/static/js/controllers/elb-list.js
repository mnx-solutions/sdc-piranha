'use strict';

(function (app) {
    app.controller(
        'slb.ListController',
        ['$scope', 'requestContext', 'localization', 'slb.Service', '$location', 'PopupDialog',
                function ($scope, requestContext, localization, service, $location, PopupDialog) {

                $scope.listLoaded = false;
                localization.bind('slb', $scope);
                requestContext.setUpRenderContext('slb.list', $scope, {
                    title: localization.translate(null, 'slb', 'Load Balancers List')
                });

                $scope.disableLb = function () {
                    PopupDialog.confirm(
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
                                if ($location.path().search('slb') !== -1) {
                                    $location.path('/');
                                }
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
                        if (!$scope.deleting || err) {
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'slb',
                                    err.message || err
                                ),
                                function () {}
                            );
                        }
                        $scope.listLoaded = true;
                    });
                }, function () {
                    $location.path('/slb');
                });

                $scope.createNew = function createNew() {
                    $location.path('/slb/edit/');
                };
            }]
    );
}(window.JP.getModule('slb')));
