'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', '$window', 'Account', 'localization', 'requestContext', function ($scope, $window, Account, localization, requestContext) {
            localization.bind('account', $scope);

            $scope.account = Account.getAccount();
        }]);
}(window.JP.getModule('Account')));