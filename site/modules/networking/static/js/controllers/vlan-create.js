'use strict';

(function (app) {
    app.controller('Vlan.CreateController', [
        '$scope',
        'requestContext',
        'localization',
        'Vlan',
        '$location',
        'util',
        function ($scope, requestContext, localization, Vlan, $location, util) {
            localization.bind('networking', $scope);
            requestContext.setUpRenderContext('networking.vlan-create', $scope, {
                title: localization.translate(null, 'networking', 'Fabric VLan Form')
            });

            $scope.datacenters = $scope.features.networkingDatacenters;
            $scope.vlan = {datacenter: $scope.datacenters[0]};
            $scope.vlanName = Vlan.name;

            $scope.goToVlansPage = function () {
                $location.path('/vlans');
                $location.replace();
            };

            $scope.createVlan = function () {
                $scope.creating = true;
                Vlan.createVlan($scope.vlan).promise.then(function () {
                    $scope.creating = false;
                    $scope.goToVlansPage();
                }, function () {
                    $scope.creating = false;
                });
            };

            $scope.isError = function (field, errorType) {
                var form = $scope.vlanForm;
                form.submitted = $scope.formSubmitted;
                return util.isFormInvalid(form, field, errorType);
            };
        }

    ]);
}(window.JP.getModule('Networking')));