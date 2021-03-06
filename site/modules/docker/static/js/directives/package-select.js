'use strict';

(function (ng, app) {
    app.directive('packageSelect', ['Package', 'PopupDialog', 'Docker',
        function (Package, PopupDialog, Docker) {
            return {
                restrict: 'EA',
                scope: {
                    name: '@',
                    datacenter: '=',
                    pkg: '=?package',
                    memory: '@?'
                },
                templateUrl: 'docker/static/partials/package-select.html',
                link: function (scope) {
                    // TODO: refactor and simplify!
                    var DEFAULT_PACKAGE_GROUP = 'Standard';
                    var SDC_DOCKER_DEFAULT_MEMORY_SIZE = 1024;
                    scope.packageGroups = [];
                    scope.loading = true;

                    var indexPackageTypes = {};
                    var defaultPackage;
                    var selectedPackage;
                    scope.$watch('datacenter', function (value) {
                        if (value) {
                            Docker.SdcPackage(scope.datacenter).then(function (list) {
                                list.forEach(function (pkg) {
                                    pkg.group = pkg.group || DEFAULT_PACKAGE_GROUP;
                                    defaultPackage = (!defaultPackage || (pkg.group === DEFAULT_PACKAGE_GROUP && pkg.default)) ? pkg : defaultPackage;
                                    if (pkg.memory === SDC_DOCKER_DEFAULT_MEMORY_SIZE && (!selectedPackage || pkg.group === DEFAULT_PACKAGE_GROUP)) {
                                        selectedPackage = pkg;
                                    } else {
                                        if (scope.memory && parseInt(scope.memory, 10) === parseInt(pkg.memory, 10)) {
                                            selectedPackage = pkg;
                                        }
                                        if (pkg.group && !indexPackageTypes[pkg.group]) {
                                            indexPackageTypes[pkg.group] = true;
                                            scope.packageGroups.push(pkg.group);
                                        }
                                    }
                                });
                                scope.packages = list;
                                scope.pkg = selectedPackage || defaultPackage;
                                scope.loading = false;
                            });
                        }
                    });
                    scope.choosePackage = function () {
                        var parentScope = scope;
                        PopupDialog.custom({
                            templateUrl: 'docker/static/partials/select-package.html',
                            openCtrl: function ($scope, dialog) {
                                angular.element('.btn.small.daffodil').blur();
                                $scope.selectedPackage = parentScope.pkg;
                                $scope.packages = parentScope.packages;
                                $scope.packageGroups = parentScope.packageGroups;

                                $scope.sortPackages = function (pkg) {
                                    return parseInt(pkg.memory, 10);
                                };

                                $scope.selectPackage = function (id) {
                                    $scope.selectedPackage = $scope.packages.find(function (pkg) {
                                        return id === pkg.id
                                    });
                                    parentScope.pkg = $scope.selectedPackage;
                                    $scope.close();
                                };

                                $scope.filterPackages = function (packageGroup) {
                                    return function (item) {
                                        return !packageGroup || packageGroup === item.group;
                                    };
                                };

                                $scope.close = function () {
                                    dialog.close();
                                };
                            }
                        });
                    };

                }
            };
        }]);
}(window.angular, window.JP.getModule('docker')));
