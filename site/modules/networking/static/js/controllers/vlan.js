'use strict';

(function (ng, app) {
    app.controller('Vlan.DetailsController', [
        '$scope',
        'requestContext',
        'localization',
        'Vlan',
        'Network',
        'PopupDialog',
        '$location',
        function ($scope, requestContext, localization, Vlan, Network, PopupDialog, $location) {
            localization.bind('networking', $scope);
            requestContext.setUpRenderContext('networking.vlan-details', $scope, {
                title: localization.translate(null, 'networking', 'Fabric VLan Details')
            });

            var vlanId = requestContext.getParam('vlanid');
            var datacenter = requestContext.getParam('datacenter');
            var id = datacenter + '&' + vlanId;

            var goToVlansPage = function () {
                $location.path('/vlans');
                $location.replace();
            };

            $scope.loading = true;
            $scope.loadingNetworks = true;
            $scope.vlanName = Vlan.name;

            Vlan.vlan(id).then(function (data) {
                $scope.loading = false;
                $scope.oldVlanData = data;
                $scope.currentVlan = ng.copy(data);
            }, function (err) {
                PopupDialog.errorObj(err);
                goToVlansPage();
            });

            Network.network('fabric').then(function (networks) {
                $scope.networks = networks.filter(function (network) {
                    return network.fabric && network.vlan_id === parseInt(vlanId, 10) && network.datacenter === datacenter;
                });
                $scope.loadingNetworks = false;
            }, function (err) {
                $scope.loadingNetworks = false;
                PopupDialog.errorObj(err);
            });

            $scope.updateVlan = function () {
                $scope.loading = true;
                var currentVlan = ng.copy($scope.currentVlan);
                Vlan.updateVlan(currentVlan).promise.then(function () {
                    $scope.loading = false;
                    $scope.oldVlanData = currentVlan;
                }, function () {
                    $scope.loading = false;
                    $scope.currentVlan = ng.copy($scope.oldVlanData);
                });
            };

            $scope.deleteVlan = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete VLan'
                    ),
                    localization.translate(
                        $scope,
                        'networking',
                        'Are you sure you want to delete this VLan?'
                    ), function () {
                        Vlan.deleteVlan($scope.currentVlan).promise.then(function () {
                            goToVlansPage();
                        });
                    });
            };

            $scope.cancel = function () {
                Vlan.resetVlan($scope.oldVlanData, function () {
                    goToVlansPage();
                });
            };

            $scope.networksExportFields = {};
            $scope.networksGridProps = [
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
                    id: 'resolvers',
                    name: 'Resolvers',
                    active: true,
                    sequence: 5,
                    _getter: function (network) {
                        return !network.resolvers || network.resolvers.length === 0 ? ' ' : network.resolvers.join(', ');
                    }
                }
            ];
        }

    ]);
}(window.angular, window.JP.getModule('Networking')));
