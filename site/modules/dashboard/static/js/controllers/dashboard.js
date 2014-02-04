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
        'PopupDialog',
        'BillingService',
        '$http',
        '$cookies',
        'slb.Service',
        '$rootScope',

        function ($scope, $$track, $q, requestContext, Account, Zendesk, Machine, localization, PopupDialog, BillingService, $http, $cookies, slbService, $rootScope) {
            localization.bind('dashboard', $scope);
            requestContext.setUpRenderContext('dashboard.index', $scope);
            $scope.loading = true;

            // populate all datasources
            $scope.account     = Account.getAccount();
            $scope.slbFeatureEnabled = $rootScope.features.slb === 'enabled';
            if ($scope.slbFeatureEnabled) {

                $scope.balancers = slbService.getBalancers();

                slbService.getController().then(function (isEnabled) {
                    $scope.slbControllerCreated = isEnabled;
                });
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

            $scope.runningcount = 0;
            $scope.othercount = 0;

            $scope.errorDialog = function () {
                PopupDialog.error(
                    localization.translate(
                        $scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Failed:  API method not found.'
                    ),function(){
                        this.close();
                    });
            };
            $scope.messageDialog = function () {
                PopupDialog.message(
                    localization.translate(
                        $scope,
                        null,
                        'Message'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Sorry, this is not implemented yet.'
                    ),function(){
                        this.close();
                    });
            };
        }

    ]);
}(window.angular, window.JP.getModule('Dashboard')));
