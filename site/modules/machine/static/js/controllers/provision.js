'use strict';

(function (app, ng) {
    app.controller(
        'Machine.ProvisionController',
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

                $scope.datacenters = Datacenter.datacenter();

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

                    if (!name && !$scope.data.datacenter) {
                        Datacenter.datacenter().then(function (datacenters) {
                            if (datacenters.length > 0) {
                                $scope.data.datacenter = datacenters[0].name;
                            }
                        });
                    } else if (name && (name !== $scope.data.datacenter)) {
                        $scope.data.datacenter = name;
                    }

                };

                $scope.selectDataset = function (id) {
                    Dataset.dataset({ id: id, datacenter: $scope.data.datacenter }).then(function (dataset) {
                        ng.element('#next').trigger('click');
                        ng.element('#step-configuration').fadeIn('fast');
                        ng.element('#selected-image').html(dataset.description);
                        ng.element('#pricing').removeClass('alert-muted');
                        ng.element('#pricing').addClass('alert-success');

                        $scope.data.dataset = dataset.id;
                        $scope.searchText = '';
                    });
                };

                $scope.filterDatasets = function (item) {
                    var props = [ 'name', 'description' ];
                    for (var i = 0, c = props.length; i < c; i++) {
                        var val = item[props[i]];
                        if (val.match($scope.searchText)) {
                            return true;
                        }
                    }

                    return false;
                };

                $scope.selectPackage = function (id) {
                    Package.package({ id: id, datacenter: $scope.data.datacenter }).then(function (pkg) {
                        ng.element('#finish-configuration').fadeIn('fast');
                        ng.element('#selected-size').html([
                            localization.translate($scope, 'machine', 'Memory') + ': ' + pkg.memory  + 'MB',
                            localization.translate($scope, 'machine', 'Disk') + ': ' + pkg.disk + 'MB',
                            localization.translate($scope, 'machine', 'vCPUs') + ': ' + pkg.vcpus
                        ].join('<br />'));

                        $scope.data.package = pkg.id;
                    });
                };

                $scope.filterPackages = function (item) {
                    var props = [ 'name', 'memory', 'disk', 'vcpus' ];
                    for (var i = 0, c = props.length; i < c; i++) {
                        var val = item[props[i]];
                        if (val.match($scope.searchText)) {
                            return true;
                        }
                    }

                    return false;
                };

                // Watch datacenter change
                $scope.$watch('data.datacenter', function (newVal, oldVal) {
                    if (newVal) {
                        Dataset.dataset({ datacenter: newVal }).then(function (datasets) {
                            $scope.datasets = datasets;
                        });

                        Package.package({ datacenter: newVal }).then(function (packages) {
                            $scope.packages = packages;
                        });
                    }
                });

                if (!$scope.data.datacenter) {
                    $scope.selectDatacenter();
                }

                ng.element('.carousel').carousel({
                    interval:false
                });

                $scope.slideCarousel = function() {
                  ng.element('.carousel').carousel('next');
                }
            }

        ]);
}(window.JP.getModule('Machine'), window.angular));
