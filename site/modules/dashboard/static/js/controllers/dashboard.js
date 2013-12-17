'use strict';

(function (ng, app) {
    app.controller('Dashboard.IndexController', [
        '$scope',
        '$$track',
        '$dialog',
        '$q',
        'requestContext',
        'Account',
        'Zendesk',
        'Machine',
        'localization',
        'util',
        'BillingService',
        '$http',
        '$cookies',
        'FreeTier',
        '$location',
        'Package',

        function ($scope, $$track, $dialog, $q, requestContext, Account, Zendesk, Machine, localization, util, BillingService,
                  $http, $cookies, FreeTier, $location, Package) {
            localization.bind('dashboard', $scope);
            requestContext.setUpRenderContext('dashboard.index', $scope);
            $scope.loading = true;

            // populate all datasources
            $scope.account     = Account.getAccount();
//                $scope.forums      = Zendesk.getForumsList();
            $scope.forums = {
                'Getting Started': 'http://wiki.joyent.com/gettingstarted',
                'Setting Up Your Application': 'http://wiki.joyent.com/wiki/display/jpc2/Setting+Up+an+Application',
                'Managing Your SmartOS Instances': 'http://wiki.joyent.com/wiki/display/jpc2/Managing+a+SmartMachine',
                'Managing Your Linux and Windows Instances': 'http://wiki.joyent.com/wiki/display/jpc2/Managing+a+Virtual+Machine',
                'Managing Your Infrastructure': 'http://wiki.joyent.com/wiki/display/jpc2/Managing+Infrastructure',
                'Running Node.js Application on Joyent': 'http://wiki.joyent.com/wiki/display/jpc2/Using+Node.js',
                'Images Available on Joyent': 'http://wiki.joyent.com/wiki/display/jpc2/Available+Joyent+Public+Cloud+Machine+Images'
            };
            $scope.systemStatusTopics = Zendesk.getSystemStatusTopics();
            $scope.softwareUpdateTopics = Zendesk.getSoftwareUpdateTopics();
            $scope.machines = Machine.machine();

            $scope.freeTierEnabled = false;
            $scope.freeTierOptions = FreeTier.listFreeTierOptions();
            $scope.packages = Package.package();

//                $scope.lastInvoice = BillingService.getLastInvoice();

            $scope.chooseFreeTierOption = function (option) {
                var searchParams = {
                    imageid: option.dataset,
                    packageid: option.package,
                    datacenter: option.datacenter
                };
                if (option.networks) {
                    searchParams.networks = option.networks;
                }
                $location.path('/compute/create').search(searchParams);
            };

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
                    $q.when($scope.systemStatusTopics),
                    $q.when($scope.softwareUpdateTopics),
                    $q.when($scope.account),
                    $q.when($scope.rssentries),
                    $q.when($scope.freeTierOptions),
                    $q.when($scope.packages)
                    ]
            ).then(function (results) {
                $scope.freeTierEnabled = $scope.features.freetier === 'yes' || $scope.features.freetier === 'enabled';
                if ($scope.freeTierEnabled) {
                    var machines = results[0];
                    var account = results[4];
                    var freeTierOptions = results[6];
                    var packages = results[7];
                    var findPackageIdByName = function (name) {
                        var result = null;
                        packages.forEach(function (packageObj) {
                            if (packageObj.name === name) {
                                result = packageObj.id;
                            }
                        });
                        return result;
                    };
                    var freeMachineFound = false;
                    machines.forEach(function (machine) {
                        var machineDatasetId = machine.image;
                        var machinePackageId = findPackageIdByName(machine.package);
                        freeTierOptions.forEach(function (option) {
                            if (option.package === machinePackageId && option.dataset === machineDatasetId) {
                                freeMachineFound = true;
                            }
                        });
                    });
                    $scope.freeTierEnabled = !freeMachineFound;
                }

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
            }, true);

            $scope.runningcount = 0;
            $scope.othercount = 0;
        }

    ]);
}(window.angular, window.JP.getModule('Dashboard')));
