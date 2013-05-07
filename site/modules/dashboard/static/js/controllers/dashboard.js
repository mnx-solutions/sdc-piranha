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
            function ($scope, $$track, $dialog, $q, requestContext, Account, Zendesk, Machine, localization, util) {
                localization.bind('dashboard', $scope);
                requestContext.setUpRenderContext('dashboard.index', $scope);

                $scope.account = Account.getAccount();

                parseRSS('http://joyent.com/blog/feed', function(response) {
                    $scope.rssentries = response.entries;
                });

                $scope.forums = Zendesk.getForumsList();

                var runningcount = 0;
                var othercount = 0;

                $scope.machines = Machine.machine();

                $scope.$watch('machines', function (machines) {
                    machines.forEach(function (machine) {
                        if (machine.state == 'running') {
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
            }

        ]);
}(window.angular, window.JP.getModule('Dashboard')));
