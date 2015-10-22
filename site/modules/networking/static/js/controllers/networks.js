'use strict';

(function (app) {
    app.controller('Networking.NetworksController', [
        '$scope',
        'PopupDialog',
        'Network',
        '$rootScope',
        'localization',
        'requestContext',
        '$location',
        function ($scope, PopupDialog, Network, $rootScope, localization, requestContext, $location) {
            localization.bind('networking', $scope);
            requestContext.setUpRenderContext('networking.index', $scope, {
                title: localization.translate(null, 'networking', 'Fabric Networks')
            });
            $scope.loading = true;
            $scope.networks = [];

            Network.listFabric().then(function (networks) {
                $scope.networks = networks || [];
                $scope.loading = false;
            }, function (err) {
                PopupDialog.errorObj(err);
                $scope.loading = false;
            });

            $scope.gotoCreatePage = function () {
                $location.path('/networks/create');
                $location.replace();
            };

            $scope.gridUserConfig = 'networks';
            $scope.gridOrder = ['name'];

            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    active: true,
                    sequence: 1,
                    _order: 'name',
                    type: 'html',
                    _getter: function (network) {
                        if (network.fabric) {
                            return '<a href="#!/networks/' + network.id + '">' + network.name + '</a>';
                        }
                        return network.name;
                    }
                },
                {
                    id: 'subnet',
                    name: 'Network',
                    active: true,
                    sequence: 2
                },
                {
                    id: 'gateway',
                    name: 'Gateway',
                    active: true,
                    sequence: 3
                },
                {
                    id: 'ipRange',
                    name: 'IP Range',
                    active: true,
                    sequence: 4
                },
                {
                    id: 'vlan_id',
                    name: 'VLAN',
                    active: true,
                    sequence: 5
                },
                {
                    id: 'resolvers',
                    name: 'Resolvers',
                    active: true,
                    sequence: 6,
                    _getter: function (network) {
                        return !network.resolvers || network.resolvers.length === 0 ? ' ' : network.resolvers.join(', ');
                    }
                },
                {
                    id: 'datacenter',
                    name: 'Datacenter',
                    active: true,
                    sequence: 7
                }
            ];

            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        PopupDialog.confirmAction(
                            'Delete Fabric Network',
                            'delete',
                            'network',
                            $scope.checkedItems.length,
                            function () {
                                Network.deleteNetworks($scope.checkedItems);
                            }
                        );
                    },
                    sequence: 1
                }
            ];
            $scope.columnsButton = true;
            $scope.exportFields = {};
            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.tabFilterField = 'datacenter';
            $scope.placeHolderText = 'filter networks';
            $scope.enabledCheckboxes = true;
            $scope.tabFilterDefault = $rootScope.commonConfig($scope.tabFilterField);
            $scope.$on('gridViewChangeTab', function (event, tab) {
                if (tab === 'all') {
                    $rootScope.clearCommonConfig($scope.tabFilterField);
                } else {
                    $rootScope.commonConfig($scope.tabFilterField, tab);
                }
            });

        }
    ]);
}(window.JP.getModule('Networking')));

