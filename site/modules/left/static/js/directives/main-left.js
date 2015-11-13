'use strict';

(function (app, ng) {
    app.directive('mainLeft', ['$rootScope', '$q', 'DTrace', 'Machine', 'Support', 'requestContext', function ($rootScope, $q, DTrace, Machine, Support, requestContext) {
        return {
            templateUrl: 'left/static/partials/menu.html',
            scope: true,
            controller: function ($scope, $location) {
                $scope.location = $location;
                $scope.sideBarMin = false;
                $rootScope.dockerHostsAvailable = false;
                var supportPackagesCallback = function (error, supportPackages) {
                    $scope.supportPackages = supportPackages;
                };

                var loadSupportPackages = function () {
                    Support.support(supportPackagesCallback, true);
                };

                if ($scope.features.support === 'enabled') {
                    $rootScope.$on('creditCardUpdate', function () {
                        if (!$scope.supportPackages || $scope.supportPackages <= 0) {
                            loadSupportPackages();
                        }
                    });
                    loadSupportPackages();
                    $scope.isActive = function (link) {
                        return '/support' + link === $location.path();
                    };

                    $scope.clickSupportMenu = function (link) {
                        $location.path('/support' + link);
                    };
                }

                $scope.toggleSideBar = function () {
                    $scope.sideBarMin = !$scope.sideBarMin;
                };

                $scope.devToolsPath = DTrace.devToolsLink();

                $scope.clickUsage = function (usageType) {
                    var now = new Date();
                    var year = parseInt(requestContext.getParam('year'), 10) || now.getFullYear();
                    var month = parseInt(requestContext.getParam('month'), 10) || now.getMonth() + 1;
                    usageType = usageType ? (usageType + '/') : '';
                    $location.path('/usage/' + usageType + year + '/' + month);
                };

                if ($scope.features.docker === 'enabled') {
                    $q.when(Machine.machine()).then(function (machines) {
                        $scope.machines = machines;
                    });
                    $scope.$watch('machines', function (machines) {
                        $rootScope.dockerHostsAvailable = machines.some(function (machine) {
                            return machine.tags && machine.tags['JPC_tag'] === 'DockerHost' &&
                                machine.state !== 'creating';
                        });
                        if (!$rootScope.dockerHostsAvailable && $location.path() === '/docker') {
                            $location.path('/docker/containers');
                        }
                        if ($scope.features.sdcDocker === 'enabled' && !$rootScope.dockerHostsAvailable) {
                            $rootScope.dockerHostsAvailable = true;
                        }
                    }, true);
                }

                $scope.checkDockerMenuOpen = function () {
                    return {
                        active: $location.path().search('docker') === 1,
                        open: $location.path().search('/registr?|/docker/containers?|/logs?|/analytics?|/images?|/audit?') > 1
                    }
                };

                $scope.clickNetwork = function () {
                    var url = $scope.features.networking != 'disabled' ? '/network/networks' : '/network/firewall';
                    $location.path(url);
                };

                $scope.currentYear = (new Date()).getFullYear();
            }
        };
    }]);

}(window.JP.getModule('Left')));
