'use strict';

(function (ng, app) {
    app.controller(
        'AccountAdmin.IndexController',
        [
            '$scope',
            '$location',
            'requestContext',
            'Account',
            'localization',
            function ($scope, $location, requestContext, Account, localization) {
                localization.bind('account-admin', $scope);
                requestContext.setUpRenderContext('account-admin.index', $scope);

                $scope.id = '';
                $scope.searchUser = function () {
                    $location.path('/account/' + $scope.id);
                };

            }

        ]);
}(window.angular, window.JP.getModule('AccountAdmin')));
