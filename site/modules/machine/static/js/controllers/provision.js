'use strict';

(function (app, ng) {
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
                        ng.element('#next').trigger('click');
                        ng.element('#step-configuration').fadeIn('fast');
                        ng.element('#selected-image').html(dataset.description);
                        ng.element('#pricing').removeClass('alert-muted');
                        ng.element('#pricing').addClass('alert-success');

                        $scope.data.dataset = dataset.id;
                        $scope.searchText = '';
                    });
                };

                $scope.selectPackage = function (id) {
                    Package.package(id).then(function (pkg) {
                        ng.element('#finish-configuration').fadeIn('fast');
                        ng.element('#selected-size').html([
                            localization.translate($scope, 'machine', 'Memory') + ': ' + pkg.memory  + 'MB',
                            localization.translate($scope, 'machine', 'Disk') + ': ' + pkg.disk + 'MB',
                            localization.translate($scope, 'machine', 'vCPUs') + ': ' + pkg.vcpus
                        ].join('<br />'));

                        $scope.data.package = pkg.id;
                    });
                };

                ng.element('.carousel').carousel({
                    interval:false
                });
            }

        ]);
}(window.JP.getModule('Machine'), window.angular));