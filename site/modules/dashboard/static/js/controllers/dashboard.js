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
                var c = 0;
                function checkAll() {
                    if(++c > 3) {
                        $scope.loading = false;
                    }
                }

                $scope.account = Account.getAccount();
                $q.when($scope.account, checkAll);

                parseRSS('http://joyent.com/blog/feed', function(response) {
                    $scope.rssentries = response.entries;
                });

                $scope.forums = Zendesk.getForumsList();
                $q.when($scope.forums, checkAll);

                var runningcount = 0;
                var othercount = 0;

                $scope.machines = Machine.machine();
                $q.when($scope.machines, checkAll);

                $scope.$watch('machines', function (machines) {
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

                $scope.runningcount = runningcount;
                $scope.othercount = othercount;
                $scope.lastInvoice = BillingService.getLastInvoice();
                $q.when($scope.lastInvoice, checkAll);
            }

        ]);
}(window.angular, window.JP.getModule('Dashboard')));
