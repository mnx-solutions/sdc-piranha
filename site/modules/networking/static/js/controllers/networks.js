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
        '$q',
        function ($scope, PopupDialog, Network, $rootScope, localization, requestContext, $location, $q) {
            localization.bind('networking', $scope);
            requestContext.setUpRenderContext('networking.index', $scope, {
                title: localization.translate(null, 'networking', 'Fabric Networks')
            });
            $scope.loading = true;
            $scope.networks = [];
            var datacenters = window.JP.get('networkingDatacenters') || [];
            var CONFIG_KEY = 'networksDatacenter';

            $q.all([
                Network.listFabric(),
                Network.getNetworkConfig(datacenters)
            ]).then(function (results) {
                $scope.networks = results[0] || [];
                var defaultNetworks = results[1].defaultNetworks || {};
                $scope.networks.forEach(function (network) {
                    network.defaultForDocker = defaultNetworks[network.datacenter] === network.id ? 'yes' : 'no';
                });
                $scope.loading = false;
            }, function (err) {
                PopupDialog.errorObj(err);
                $scope.loading = false;
            });

            $scope.gotoCreatePage = function () {
                $location.path('/network/networks/create');
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
                    type: 'progress',
                    _inProgress: function (network) {
                        return network.actionInProgress;
                    },
                    _getter: function (network) {
                        if (network.fabric) {
                            return '<a href="#!/network/networks/' + network.id + '">' + network.name + '</a>';
                        }
                        return network.name;
                    }
                },
                {
                    id: 'subnet',
                    name: 'Subnet',
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
                    id: 'defaultForDocker',
                    name: 'Default for Docker',
                    active: true,
                    sequence: 7
                },
                {
                    id: 'datacenter',
                    name: 'Datacenter',
                    active: true,
                    sequence: 8
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
                                $scope.checkedItems.forEach(function (network) {
                                    network.actionInProgress = true;
                                });
                                Network.deleteNetworks($scope.checkedItems).done(function (err, job) {
                                    var deletedNetworks = job.__read();
                                    $scope.networks = $scope.networks.filter(function (network) {
                                        return deletedNetworks.every(function (deletedNetwork) {
                                            return deletedNetwork.error && network.id === deletedNetwork.network.id ||
                                                network.id !== deletedNetwork.id;
                                        });
                                    });
                                    $scope.checkedItems = [];
                                });
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
            $scope.tabFilterDefault = $rootScope.commonConfig(CONFIG_KEY);
            $scope.$on('gridViewChangeTab', function (event, tab) {
                if (tab === 'all') {
                    $rootScope.clearCommonConfig(CONFIG_KEY);
                } else {
                    $rootScope.commonConfig(CONFIG_KEY, tab);
                }
            });

        }
    ]);
}(window.JP.getModule('Networking')));
