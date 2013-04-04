'use strict';

(function (app) {
    app.controller(
        'ProvisionController',
        [   '$scope',
            '$filter',
            'requestContext',
            'Machine',
            'Dataset',
            'Datacenter',
            'Package',
            '$dialog',
            '$location',
            'localization',
            function ($scope, $filter, requestContext, Machine, Dataset, Datacenter, Package, $dialog, $location, localization) {
                localization.bind('machine', $scope);
                requestContext.setUpRenderContext('machine.provision', $scope);

                Dataset.updateDatasets();
                Datacenter.updateDatacenters();

                var confirm = function (question, callback) {
                    var title = 'Confirm';
                    var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                    $dialog.messageBox(title, question, btns)
                        .open()
                        .then(function(result){
                            if(result === 'ok'){
                                callback();
                            }
                        });
                };

                var packages = Package.package();
                $scope.packages = packages;

                var datasets = Dataset.dataset();
                $scope.datasets = datasets;

                var datacenters = Datacenter.datacenter();
                $scope.datacenters = datacenters;

                $scope.data = {};

                $scope.clickProvision = function () {
                    confirm(localization.translate($scope, 'machine', 'Are you sure it works?'), function () {
                        $scope.retinfo = Machine.provisionMachine($scope.data);
                        $location.path("/machine");
                    });
                };

            }

        ]);
}(window.JP.getModule('Machine')));