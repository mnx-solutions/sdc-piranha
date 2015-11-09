'use strict';

(function (ng, app) {
    app.controller('Network.CreateController', [
        '$rootScope',
        '$scope',
        'requestContext',
        'localization',
        'Network',
        'Vlan',
        '$location',
        'util',
        function ($rootScope, $scope, requestContext, localization, Network, Vlan, $location, util) {
            localization.bind('networking', $scope);
            requestContext.setUpRenderContext('networking.vlan-create', $scope, {
                title: localization.translate(null, 'networking', 'Fabric Network Form')
            });

            $scope.datacenters = window.JP.get('networkingDatacenters') || [];
            $scope.network = {};
            $scope.loading = true;
            $scope.routes = [{subnet: '', gateway: ''}];
            $scope.vlan = {};
            $scope.name = Vlan.name;
            $scope.goToNetworksPage = function () {
                $scope.creating = false;
                $location.path('/network/networks');
                $location.replace();
            };
            $scope.provisionNAT = true;
            var changeVlanValue = function (vlan) {
                $scope.network.vlan_id = vlan.vlan_id;
                $scope.vlanCreating = false;
                $scope.createVlanForm = false;
                $scope.vlan = {};
            };

            Vlan.vlan().then(function (vlans) {
                $scope.vlans = vlans || [];
                $scope.network.datacenter = vlans && vlans.length && vlans[0].datacenter;
                $scope.createVlanForm = $scope.vlans.length === 0;
                $scope.network.vlan_id = $scope.createVlanForm ? null : $scope.vlans[0].vlan_id;
                $scope.loading = false;
            });

            $scope.isError = function (field, errorType) {
                var form = $scope.networkForm;
                form.submitted = $scope.formSubmitted;
                return util.isFormInvalid(form, field, errorType);
            };

            $scope.changeDatacenter = function () {
                var index;
                var doesDatacenterHaveVlans = $scope.vlans.some(function (vlan, i) {
                    index = i;
                    return vlan.datacenter === $scope.network.datacenter;
                });

                if (doesDatacenterHaveVlans) {
                    changeVlanValue($scope.vlans[index]);
                } else {
                    $scope.network.vlan_id = '';
                    $scope.createVlanForm = true;
                }
            };

            $scope.changeProvisionNAT = function () {
                $scope.provisionNAT = !$scope.provisionNAT;
            };

            $scope.createNetwork = function () {
                $scope.creating = true;
                var network = $scope.network;
                if (!network.gateway) {
                    delete network.gateway;
                }
                network.routes = {};
                if (!$scope.provisionNAT) {
                    network.no_internet_nat = true;
                }
                $scope.routes.forEach(function (route) {
                    if (route.subnet && route.gateway) {
                        network.routes[route.subnet] = route.gateway;
                    }
                });
                Network.createNetwork(network).promise.then(function () {
                    $rootScope.commonConfig('networksDatacenter', $scope.network.datacenter);
                    setTimeout($scope.goToNetworksPage, 500);
                }, function () {
                    $scope.creating = false;
                });
            };

            $scope.addRoute = function () {
                $scope.routes.push({subnet: '', gateway: ''});
            };

            $scope.removeRoute = function (index) {
                $scope.routes.splice(index, 1);
            };

            $scope.createVlan = function () {
                $scope.vlan.datacenter = $scope.network.datacenter;
                $scope.vlanCreating = true;
                Vlan.createVlan($scope.vlan, $location.path()).promise.then(function (vlan) {
                    changeVlanValue(vlan);
                }, function () {
                    $scope.vlanCreating = false;
                });

            };
        }

    ]);
}(window.angular, window.JP.getModule('Networking')));
