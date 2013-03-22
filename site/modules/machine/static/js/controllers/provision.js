'use strict';

(function (app) {
    app.controller(
        'ProvisionController',
        [   '$scope',
            '$filter',
            'requestContext',
            'Machines',
            "$dialog",
            '$location',
            function ($scope, $filter, requestContext, Machines, $dialog, $location) {

                requestContext.setUpRenderContext('machine.details', $scope);

                Machines.updateDatasets();
                Machines.updateDatacenters();

                var confirm = function (question, callback) {
                    var title = 'Confirm';
                    var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                    $dialog.messageBox(title, question, btns)
                        .open()
                        .then(function(result){
                            if(result=='ok'){
                                callback();
                            }
                        });
                };

                var packages = Machines.getPackages();
                $scope.packages = packages;

                var datasets = Machines.getDatasets();
                $scope.datasets = datasets;

                var datacenters = Machines.getDatacenters();
                $scope.datacenters = datacenters;

                $scope.clickProvision = function () {
                    confirm("Are you sure it works?", function () {
                        $scope.retinfo = Machines.provisionMachine($scope.machinename, $scope.sdcpackage, $scope.dataset);
                        $location.path("/machine");
                    });
                }


            }

        ]);
}(window.JP.getModule('Machine')));