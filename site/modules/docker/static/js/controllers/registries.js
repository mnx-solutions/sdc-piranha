'use strict';

(function (app) {
    app.controller(
        'Docker.RegistriesController', [
            '$scope',
            'Docker',
            'Account',
            'PopupDialog',
            'localization',
            '$location',

            function ($scope, Docker, Account, PopupDialog, localization, $location) {

                $scope.loading = true;
                $scope.registries = [];

                var errorCallback = function (err, dialog) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                $scope.registries = [];

                Docker.getRegistriesList().then(function (list) {
                    $scope.registries = list;
                    $scope.loading = false;
                });

                var deleteFromRegistries = function (registry) {
                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: Delete registry'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Please confirm that you want to delete this registry.'
                        ), function () {
                            var index = $scope.registries.indexOf(registry);
                            if (index !== -1) {
                                $scope.registries.splice(index, 1);
                            }
                            Docker.saveRegistriesList(angular.copy($scope.registries));
                        }
                    );
                };

                $scope.gridUserConfig = Account.getUserConfig().$child('docker-registries');

                $scope.gridOrder = [];
                $scope.gridProps = [
                    {
                        id: 'api',
                        name: 'API Version',
                        sequence: 1,
                        active: true
                    },
                    {
                        id: 'host',
                        name: 'Hostname',
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'port',
                        name: 'Port',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'username',
                        name: 'Username',
                        sequence: 4,
                        active: true
                    },
                    {
                        id: '',
                        name: 'Action',
                        sequence: 5,
                        active: true,
                        type: 'buttons',
                        buttons: [
                            {
                                label: 'Edit',
                                getClass: function () {
                                    return 'btn grid-mini-btn view effect-orange-button';
                                },
                                disabled: function (object) {
                                    return !object.id;
                                },
                                action: function (object) {
                                    $scope.connectNewRegistry(object.id);
                                }
                            },
                            {
                                label: 'Delete',
                                getClass: function () {
                                    return 'btn grid-mini-btn download effect-orange-button';
                                },
                                action: function (object) {
                                    deleteFromRegistries(object);
                                }
                            }
                        ]
                    }
                ];
                $scope.gridActionButtons = [];
                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = false;
                $scope.placeHolderText = 'filter registries';

                $scope.connectNewRegistry = function (registry) {
                    registry = registry || 'create';
                    $location.path('docker/registry/' + registry);
                };
            }
        ]);
}(window.JP.getModule('docker')));