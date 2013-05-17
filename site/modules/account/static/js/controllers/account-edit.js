'use strict';

(function (app) {
    app.controller(
        'Account.EditController',
        ['$scope', '$window', 'Account', 'localization', 'requestContext', function ($scope, $window, Account, localization, requestContext) {
            requestContext.setUpRenderContext('account.edit', $scope);
            localization.bind('account', $scope);

			      $scope.updateable = ['email','firstName','lastName','phone'];
            $scope.updateable2 = ['companyName','address','postalCode','city','state','country'];

            $scope.userPlatform = $window.navigator.platform;

            $scope.saving = false;

            $scope.updateAccount = function () {
                $scope.saving = true;
                Account.updateAccount($scope.account).then(function (newAccount) {
                    $scope.setAccount(newAccount);
                    $scope.saving = false;
                }, function (err) {
                    $scope.saving = false;
                });

            };

        }]);
}(window.JP.getModule('Account')));