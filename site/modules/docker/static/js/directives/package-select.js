'use strict';

(function (ng, app) {
    app.directive('packageSelect', ['Package', 'PopupDialog', 'Docker',
        function (Package, PopupDialog, Docker) {
            return {
                restrict: 'EA',
                scope: {
                    name: '@',
                    pkg: '=?package',
                    memory: '@?'
                },
                templateUrl: 'docker/static/partials/package-select.html',
                link: function (scope) {
                    var DEFAULT_PACKAGE_GROUP = 'Standard';
                    scope.packageTypes = [];

                    var indexPackageTypes = {};
                    var defaultPackage;
                    var selectedPackage;
                    Docker.SdcPackage().then(function (list) {
                         list.forEach(function (pkg) {
                            pkg.group = pkg.group || DEFAULT_PACKAGE_GROUP;
                            defaultPackage = (!defaultPackage || (pkg.group === DEFAULT_PACKAGE_GROUP && pkg.default)) ? pkg : defaultPackage;
                            if (scope.memory && parseInt(scope.memory, 10) === parseInt(pkg.memory, 10)) {
                                selectedPackage = pkg;
                            }
                            if (pkg.group && !indexPackageTypes[pkg.group]) {
                                indexPackageTypes[pkg.group] = true;
                                scope.packageTypes.push(pkg.group);
                            }
                        });
                        scope.packages = list;
                        scope.pkg = selectedPackage || defaultPackage;
                    });
                    scope.choosePackage = function () {
                        var parentScope = scope;
                        PopupDialog.custom({
                            templateUrl: 'docker/static/partials/select-package.html',
                            openCtrl: function ($scope, dialog) {

                                $scope.selectedPackage = parentScope.pkg;
                                $scope.packages = parentScope.packages;
                                $scope.packageTypes = parentScope.packageTypes;

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

                                $scope.filterPackages = function (packageType) {
                                    return function (item) {
                                        return !packageType || packageType === item.group;
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
