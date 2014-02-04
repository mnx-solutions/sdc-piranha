'use strict';

(function (ng, app) {
    app.controller(
        'DashboardAdmin.IndexController',
        [
            '$scope',
            '$$track',
            '$q',
            'requestContext',
            'Account',
            'localization',
            function ($scope, $$track, $q, requestContext, Account, localization) {
                localization.bind('dashboard-admin', $scope);
                requestContext.setUpRenderContext('dashboard-admin.index', $scope);

                $scope.account = Account.getAccount();
            }

        ]);
}(window.angular, window.JP.getModule('DashboardAdmin')));
