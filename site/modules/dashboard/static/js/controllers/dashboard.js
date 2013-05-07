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
            'localization',
            'util',
            function ($scope, $$track, $dialog, $q, requestContext, Account, Zendesk, localization, util) {
                localization.bind('dashboard', $scope);
                requestContext.setUpRenderContext('dashboard.index', $scope);

                $scope.account = Account.getAccount();

                parseRSS('http://joyent.com/blog/feed', function(response) {
                    $scope.rssentries = response.entries;
                });

                $scope.forums = Zendesk.getForumsList();
            }

        ]);
}(window.angular, window.JP.getModule('Dashboard')));
