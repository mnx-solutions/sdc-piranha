'use strict';

(function (ng, app) {
    app.controller('Dashboard.IndexController', ['$scope', '$q', '$sce', 'requestContext', 'Account', 'Machine',
        'localization', '$http', '$cookies', 'slb.Service', '$rootScope', 'Support', 'fileman', 'Utilization', 'util',
        'Datacenter', 'FreeTier', '$location', 'Docker', 'Storage',

        function ($scope, $q, $sce, requestContext, Account, Machine, localization, $http, $cookies, slbService,
                  $rootScope, Support, fileman, Utilization, util, Datacenter, FreeTier, $location, Docker, Storage) {
            localization.bind('dashboard', $scope);
            requestContext.setUpRenderContext('dashboard.index', $scope);
            $scope.loading = true;

            var tritonDatacenters = window.JP.get('tritonDatacenters') || '';

            // populate all datasources
            var INITIAL_COUNT_VALUE = '-';
            $scope.account = {};
            $scope.slbFeatureEnabled = $rootScope.features.slb === 'enabled';
            $scope.usageDataFeatureEnabled = $rootScope.features.usageData === 'enabled';
            $scope.mantaEnabled = $rootScope.features.manta === 'enabled';
            $scope.dockerEnabled = $rootScope.features.docker === 'enabled';
            $scope.mantaMemory = {value: ''};

            $scope.machines = [];
            $scope.gotoCreatePage = Machine.gotoCreatePage;

            // get campaign id from the cookie
            $scope.campaignId = ($cookies.campaignId || 'default');
            var marketingConfig = window.JP.get('marketing');
            var campaignId = $scope.campaignId;
            if (marketingConfig.campaigns.indexOf(campaignId) === -1) {
                campaignId = 'default';
            }
            if (marketingConfig.baseAdUrl) {
                var dashboardAdUrl = marketingConfig.baseAdUrl + '/' + campaignId + '.html';
                $scope.dashboardAd = $sce.trustAsHtml('<iframe src="' + dashboardAdUrl + '"></iframe>');
            }

            if ($rootScope.features.blogEntries === 'enabled') {
                window['dashboard_rss_feed_callback'] = function (data) {
                    $scope.rssentries = data.responseData.feed.entries;
                };
                $http.jsonp('//ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=7&callback=dashboard_rss_feed_callback&q=' + encodeURIComponent('http://www.joyent.com/blog/feed'));
            }

            var dashboardOperations = [
                $q.when(Account.getAccount()),
                $q.when($scope.rssentries),
                $q.when(Machine.machine())
            ];
            if ($rootScope.features.docker === 'enabled') {
                $scope.runningContainers = $scope.otherContainers = INITIAL_COUNT_VALUE;
                dashboardOperations = dashboardOperations.concat([
                    $q.when(Storage.pingManta(function () {
                        Docker.getContainersCount().then(function (containers) {
                            $scope.runningContainers = containers.running;
                            $scope.otherContainers = containers.stopped;
                        });
                    }))
                ]);
            }
            // when all datasources are loaded, disable loader
            $q.all(dashboardOperations).then(function (result) {
                $scope.account = result[0] || {};
                var tasks = [];
                if ($scope.account.provisionEnabled) {
                    $scope.mantaMemory = {value: INITIAL_COUNT_VALUE};
                    if ($rootScope.features.support === 'enabled') {
                        $scope.supportTile = [];
                        Support.support(function (error, supportPackages) {
                            supportPackages.forEach(function (supportPackage) {
                                $scope.supportTile.push(supportPackage.currentShortName);
                            });
                        });
                    }
                    $scope.machines = result[2] || [];
                    if ($scope.machines.length === 0) {
                        $scope.runningcount = $scope.othercount = 0;
                    }

                    if ($scope.slbFeatureEnabled) {
                        tasks.push($q.when(slbService.getBalancers()));
                        tasks.push($q.when(slbService.getController()));
                    }

                    $q.all(tasks).then(function (tasksResult) {
                        if ($scope.slbFeatureEnabled) {
                            $scope.balancers = tasksResult[0];
                            $scope.slbControllerCreated = tasksResult[1];
                        }
                    });
                    if ($scope.mantaEnabled) {
                        fileman.storageReport('latest', function (err, res) {
                            if (err || !res.__read()) {
                                return false;
                            }
                            var file = JSON.parse(res.__read());
                            var memory = 0;
                            ng.forEach(file.storage, function (storage) {
                                memory += parseInt(storage.bytes, 10);
                            });

                            $scope.mantaMemory = util.getReadableFileSize(memory);
                            return true;
                        });
                    }
                }
                $scope.loading = false;
            });

            // count running/not running machines
            $scope.$watch('machines', function (machines) {
                if ($scope.loading) {
                    return;
                }
                var runningcount = 0;
                var othercount = 0;

                machines.forEach(function (machine) {
                    // excluding triton SDC Docker Containers
                    if (machine.tags && machine.tags.sdc_docker) {
                        return;
                    }
                    if (machine.state === 'running') {
                        runningcount += 1;
                    } else {
                        othercount += 1;
                    }
                });

                $scope.runningcount = runningcount;
                $scope.othercount = othercount;

                if ($scope.features.freetier === 'enabled') {
                    freeTierTileStatus();
                }
            }, true);

            $scope.runningcount = $scope.othercount = INITIAL_COUNT_VALUE;

            if ($scope.features.usageData === 'enabled') {
                var now = new Date();
                var year = now.getFullYear();
                var month = now.getMonth() + 1;
                Utilization.utilization(year, month, function (error, utilizationData) {
                    $scope.utilization = utilizationData;
                    $scope.utilization.url = '#!/usage/' + year + '/' + month;
                    $scope.bandwidth = util.getReadableFileSize(utilizationData.bandwidth.totalOut);
                    var currentspendTotal = utilizationData.currentspend.total;
                    $scope.currentspend = util.getReadableCurrencyString(currentspendTotal, 2);
                    $scope.dram = util.getReadableDramUsage(utilizationData.compute.totalUsage);
                });
            }

            $scope.validFreeTier = false;
            var freeTierTileStatus = function () {
                $scope.showAddFreeTier = false;
                $scope.freeTierOptions = FreeTier.freetier();
                $scope.freeTierOptions.then(function (freeImages) {
                    Datacenter.datacenter().then(function (datacenters) {
                        if (tritonDatacenters) {
                            $scope.datacenters = datacenters.filter(function (datacenter) {
                                return tritonDatacenters.indexOf(datacenter.name) === -1;
                            });
                        } else {
                            $scope.datacenters = angular.copy(datacenters);
                        }

                        if (freeImages.valid) {
                            $scope.validUntil = freeImages.validUntil;
                            $scope.validFreeTier = true;
                            $scope.datacenters.forEach(function (datacenter) {
                                datacenter.lightbulb = freeImages.some(function (freeImage) {
                                    return freeImage.datacenters.indexOf(datacenter.name) !== -1;
                                });
                                if (datacenter.lightbulb) {
                                    datacenter.tooltip = 'No free dev tier instances in this data center';
                                    $scope.showAddFreeTier = true;
                                } else {
                                    $scope.machines.forEach(function (machine) {
                                        if (machine.freetier && datacenter.name === machine.datacenter) {
                                            datacenter.tooltip = 'Instance ' + machine.name + ' is ' + machine.state;
                                        }
                                    });
                                }
                            });

                        }
                        if ($scope.datacenters.length < 4) {
                            $scope.datacenters.length = 4;
                        }
                    });
                });
            };

            if ($scope.features.freetier === 'enabled') {
                freeTierTileStatus();
            }

            $scope.gotoPage = function (path) {
                $location.path(path);
            };
        }
    ]);
}(window.angular, window.JP.getModule('Dashboard')));
