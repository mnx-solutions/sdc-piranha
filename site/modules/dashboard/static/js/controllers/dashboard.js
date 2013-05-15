'use strict';

(function (ng, app) {
    app.controller(
        'Dashboard.IndexController',
        [
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
            function ($scope, $$track, $dialog, $q, requestContext, Account, Zendesk, Machine, localization, util, BillingService) {
                localization.bind('dashboard', $scope);
                requestContext.setUpRenderContext('dashboard.index', $scope);
                $scope.loading = true;

                // populate all datasources
                $scope.account     = Account.getAccount();
                $scope.forums      = Zendesk.getForumsList();
                $scope.systemStatusTopics = Zendesk.getSystemStatusTopics();
                $scope.softwareUpdateTopics = Zendesk.getSoftwareUpdateTopics();
                $scope.machines    = Machine.machine();
                $scope.lastInvoice = BillingService.getLastInvoice();

                parseRSS('http://joyent.com/blog/feed', function(response) {
                    $scope.rssentries = response.entries;
                });

                // when all datasources are loaded, disable loader
                $q.all(
                   [$q.when($scope.machines),
                    $q.when($scope.lastInvoice),
                    $q.when($scope.forums),
                    $q.when($scope.systemStatusTopics),
                    $q.when($scope.softwareUpdateTopics),
                    $q.when($scope.account),
                    $q.when($scope.rssentries)
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
            }

        ]);
}(window.angular, window.JP.getModule('Dashboard')));
