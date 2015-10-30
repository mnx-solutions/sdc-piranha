'use strict';

(function (app) {
    app.controller('Network.DetailsController', [
        '$scope',
        'requestContext',
        'localization',
        'Machine',
        'Network',
        'PopupDialog',
        function ($scope, requestContext, localization, Machine, Network, PopupDialog) {
            localization.bind('networking', $scope);
            requestContext.setUpRenderContext('networking.details', $scope, {
                title: localization.translate(null, 'networking', 'Fabric Network Details')
            });

            var networkId = requestContext.getParam('networkid');
            $scope.loading = true;

            var setCurrentDefaultNetwork = function (defaultIdForDocker) {
                $scope.currentDefaultNetwork = defaultIdForDocker || $scope.currentDefaultNetwork;
                $scope.network.defaultForDocker = $scope.currentDefaultNetwork === $scope.network.id ? 'yes' : 'no';
            };

            var getDefaultNetwork = function () {
                return {
                    id: $scope.currentDefaultNetwork,
                    datacenter: $scope.network.datacenter
                };
            };

            Network.getFabricNetwork(networkId).then(function (network) {
                $scope.loading = false;
                $scope.hasRoutes = network && network.routes && Object.keys(network.routes).length;
                $scope.network = network || {};
                $scope.network.defaultForDocker = 'no';
                if ($scope.network.datacenter) {
                    Network.getNetworkConfig($scope.network.datacenter).then(function (config) {
                        config = config.defaultNetworks || {};
                        setCurrentDefaultNetwork(config[$scope.network.datacenter]);
                    }, function (error) {
                        PopupDialog.errorObj(error);
                    });
                }
            }, function (err) {
                PopupDialog.errorObj(err);
                $scope.loading = false;
                $location.path('/network/networks');
            });

            $scope.setDefaultNetwork = function () {
                $scope.isDialogOpening = true;
                var opts = {
                    templateUrl: 'networking/static/partials/set-default-network.html',
                    openCtrl: function ($scope, dialog, Network) {
                        $scope.loading = true;
                        $scope.newNetwork = getDefaultNetwork();
                        Network.listFabric().then(function (networks) {
                            $scope.networks = (networks || []).filter(function (network) {
                                return network.datacenter === $scope.newNetwork.datacenter;
                            });
                            $scope.loading = false;
                        }, function (err) {
                            PopupDialog.errorObj(err);
                            $scope.loading = false;
                        });
                        $scope.close = function (newNetworkId) {
                            dialog.close({defaultIdForDocker: newNetworkId});
                        };

                        $scope.setNetwork = function () {
                            Network.updateNetworkConfig($scope.newNetwork.datacenter, $scope.newNetwork.id).then(function () {
                                $scope.close($scope.newNetwork.id);
                            }, function (error) {
                                PopupDialog.error(null, error);
                            });
                        };
                    }
                };
                PopupDialog.custom(opts, function (result) {
                    $scope.isDialogOpening = false;
                    setCurrentDefaultNetwork(result.defaultIdForDocker);
                });
            };
        }
    ]);
}(window.JP.getModule('Networking')));
