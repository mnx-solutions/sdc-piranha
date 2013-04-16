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
                    function provision() {
                        confirm(localization.translate($scope, 'machine', 'Are you sure it works?'), function () {
                            $scope.retinfo = Machine.provisionMachine($scope.data);
                            $location.path('/machine');
                        });
                    }

                    if (!$scope.data.datacenter) {
                        Datacenter.datacenter().then(function (datacenters) {
                            var keys = Object.keys(datacenters);
                            if (keys.length > 0) {
                                $scope.data.datacenter = keys[0];
                                provision();
                            } else {
                                // TODO: Throw an error
                            }
                        });
                    } else {
                        provision();
                    }
                };

                $scope.selectDatacenter = function (name) {
                    $scope.data.datacenter = name;
                };

                $scope.selectDataset = function (id) {
                    Dataset.dataset(id).then(function (dataset) {
                        angular.element('#next').trigger('click');
                        angular.element('#step-configuration').fadeIn('fast');
                        angular.element('#selected-image').html(dataset.description);
                        angular.element('#pricing').removeClass('alert-muted');
                        angular.element('#pricing').addClass('alert-success');

                        $scope.data.dataset = dataset.id;
                        $scope.searchText = '';
                    });
                };

                $scope.selectPackage = function (id) {
                    Package.package(id).then(function (pkg) {
                        angular.element('#finish-configuration').fadeIn('fast');
                        angular.element('#selected-size').html([
                            localization.translate($scope, 'machine', 'Memory') + ': ' + pkg.memory  + 'MB',
                            localization.translate($scope, 'machine', 'Disk') + ': ' + pkg.disk + 'MB',
                            localization.translate($scope, 'machine', 'vCPUs') + ': ' + pkg.vcpus
                        ].join('<br />'));

                        $scope.data.package = pkg.id;
                    });
                };

                angular.element('.carousel').carousel({
                    interval:false
                });
            }

        ]);
}(window.JP.getModule('Machine')));