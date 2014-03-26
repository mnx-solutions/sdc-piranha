'use strict';

(function (ng, app) {
    app.controller('Dashboard.IndexController', [
        '$scope',
        '$$track',
        '$q',
        'requestContext',
        'Account',
        'Zendesk',
        'Machine',
        'localization',
        'BillingService',
        '$http',
        '$cookies',
        'slb.Service',
        '$rootScope',
        'Support',
        'fileman',
        'Utilization',
        'util',

        function ($scope, $$track, $q, requestContext, Account, Zendesk, Machine, localization, BillingService, $http, $cookies, slbService, $rootScope, Support, fileman, Utilization, util) {
            localization.bind('dashboard', $scope);
            requestContext.setUpRenderContext('dashboard.index', $scope);
            $scope.loading = true;

            // populate all datasources
            $scope.account     = Account.getAccount();
            $scope.slbFeatureEnabled = $rootScope.features.slb === 'enabled';
            $scope.usageDataFeatureEnabled = $rootScope.features.usageData === 'enabled';
            $scope.mantaEnabled = $rootScope.features.manta === 'enabled';
            if ($scope.slbFeatureEnabled) {

                $scope.balancers = slbService.getBalancers();

                slbService.getController().then(function (isEnabled) {
                    $scope.slbControllerCreated = isEnabled;
                });
            }
            if ($rootScope.features.support === 'enabled') {
                // TODO Suppotr tile
            }


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

//                $scope.lastInvoice = BillingService.getLastInvoice();

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
            }, true);

            if ($scope.mantaEnabled) {
                fileman.storageReport('latest', function (err, res) {
                    if (err || !res.__read()) {
                        $scope.mantaEnabled = false;
                        return false;
                    }
                    var file = JSON.parse(res.__read());
                    var memory = 0;
                    ng.forEach(file.storage, function (storage) {
                        memory += parseInt(storage.bytes, 10);
                    });

                    $scope.mantaMemory = util.getReadableFileSizeString(memory);
                });
            }

            $scope.runningcount = 0;
            $scope.othercount = 0;

            Utilization.utilization(function (error, utilizationData) {
                $scope.utilization = utilizationData;
            });
        }
    ]);
}(window.angular, window.JP.getModule('Dashboard')));
