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

            Network.getFabricNetwork(networkId).then(function (network) {
                $scope.loading = false;
                $scope.hasRoutes = network && network.routes && Object.keys(network.routes).length;
                $scope.network = network || {};
            }, function (err) {
                PopupDialog.errorObj(err);
                $scope.loading = false;
                $location.path('/network/networks');
            });
        }

    ]);
}(window.JP.getModule('Networking')));
