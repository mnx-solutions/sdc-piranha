'use strict';

(function (ng, app) {
    app.controller('Dashboard.IndexController', [
        '$scope',
        '$q',
        'requestContext',
        'Account',
        'Zendesk',
        'Machine',
        'localization',
        '$http',
        '$cookies',
        'slb.Service',
        '$rootScope',
        'Support',
        'fileman',
        'Utilization',
        'util',
        'Datacenter',
        'FreeTier',

        function ($scope, $q, requestContext, Account, Zendesk, Machine, localization, $http, $cookies, slbService, $rootScope, Support, fileman, Utilization, util, Datacenter, FreeTier) {
            localization.bind('dashboard', $scope);
            requestContext.setUpRenderContext('dashboard.index', $scope);
            $scope.loading = true;

            // populate all datasources
            $scope.account     = Account.getAccount();
            $scope.slbFeatureEnabled = $rootScope.features.slb === 'enabled';
            $scope.usageDataFeatureEnabled = $rootScope.features.usageData === 'enabled';
            $scope.mantaEnabled = $rootScope.features.manta === 'enabled';
            $scope.mantaMemory = {};
            $scope.systemStatusTopics = [];

            if ($scope.slbFeatureEnabled) {

                $scope.balancers = slbService.getBalancers();

                slbService.getController().then(function (isEnabled) {
                    $scope.slbControllerCreated = isEnabled;
                });
            }
            if ($rootScope.features.support === 'enabled') {
                $scope.supportTile = [];
                Support.support(function (error, supportPackages) {
                    for (var name in supportPackages) {
                        $scope.supportTile.push(supportPackages[name].currentShortName);
                    }
                });
            }


//                $scope.forums      = Zendesk.getForumsList();
            $scope.forums = {
                'Getting Started': 'http://wiki.joyent.com/wiki/display/jpc2/Getting+Started+with+your+Joyent+Cloud+Account',
                'Setting Up Your Application': 'http://wiki.joyent.com/wiki/display/jpc2/Setting+Up+an+Application',
                'Managing Your SmartOS Instances': 'http://wiki.joyent.com/wiki/display/jpc2/Managing+a+SmartOS+Instance',
                'Managing Your Linux and Windows Instances': 'http://wiki.joyent.com/wiki/display/jpc2/Managing+a+Virtual+Machine',
                'Managing Your Infrastructure': 'http://wiki.joyent.com/wiki/display/jpc2/Managing+Infrastructure',
                'Running Node.js Application on Joyent': 'http://wiki.joyent.com/wiki/display/jpc2/Using+Node.js',
                'Images Available on Joyent': 'http://wiki.joyent.com/wiki/display/jpc2/Joyent+Cloud+Images'
            };
            $scope.softwareUpdateTopics = Zendesk.getSoftwareUpdateTopics();
            $scope.machines = Machine.machine();
            $scope.gotoCreatePage = Machine.gotoCreatePage;

            // get campaign id from the cookie
            $scope.campaignId = ($cookies.campaignId || 'default');

            window.dashboard_rss_feed_callback = function (data) {
                $scope.rssentries = data.responseData.feed.entries;
            };
            $http.jsonp('//ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=7&callback=dashboard_rss_feed_callback&q=' + encodeURIComponent('http://www.joyent.com/blog/feed'));

            // when all datasources are loaded, disable loader
            $q.all(
                [$q.when($scope.machines),
                    $q.when($scope.forums),
                    $q.when($scope.softwareUpdateTopics),
                    $q.when($scope.account),
                    $q.when($scope.rssentries),
                    $q.when($scope.balancers)
                ]).then( function(){
                $scope.loading = false;
            });


            // count running/not running machines
            $scope.$watch('machines', function (machines) {
                var runningcount = 0;
                var othercount = 0;

                machines.forEach(function (machine) {
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

                    $scope.mantaMemory = util.getReadableFileSizeString(memory);
                    return true;
                });
            }

            $scope.runningcount = 0;
            $scope.othercount = 0;

            if ($scope.features.usageData === 'enabled') {
                var now = new Date();
                var year = now.getFullYear();
                var month = now.getMonth() + 1;
                Utilization.utilization(year, month, function (error, utilizationData) {
                    $scope.utilization = utilizationData;
                    $scope.utilization.url = '#!/usage/' + year + '/' + month;
                    $scope.bandwidth = util.getReadableFileSizeString(utilizationData.bandwidth.totalOut);
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
                        $scope.datacenters = ng.copy(datacenters);
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
                                            datacenter.tooltip = 'Instance '+ machine.name + ' is ' + machine.state;
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

            var updateSystemStatusTopics = setInterval(function () {
                $scope.$apply(function() {
                    getSystemStatusTopics();
                });
            }, 60000);

            function getSystemStatusTopics () {
                Zendesk.getSystemStatusTopics().then(function (topics) {
                    if ($scope.features.systemStatusTile === 'enabled') {
                        $scope.systemStatusTopics = topics.filter(function (topic) {
                            return new Date().getTime() < (new Date(topic.created_at).getTime() + 2 * 24 * 3600 * 1000);
                        });
                        if ($scope.systemStatusTopics.length > 1) {
                            $scope.systemStatusTopics.length = 2;
                        }
                    } else {
                        $scope.systemStatusTopics = topics;
                    }
                    $scope.loadedSystemStatusTopics = true;
                });
            }

            $scope.loadedSystemStatusTopics = false;
            getSystemStatusTopics();

            $scope.$on('$destroy', function() {
                clearInterval(updateSystemStatusTopics);
            });
        }


    ]);
}(window.angular, window.JP.getModule('Dashboard')));
