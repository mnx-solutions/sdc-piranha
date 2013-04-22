'use strict';

(function (app) {
    app.controller(
        'AccountEditController',
        ['$scope', '$window', 'Account', 'localization', 'requestContext', function ($scope, $window, Account, localization, requestContext) {
            requestContext.setUpRenderContext('account.edit', $scope);
            localization.bind('account', $scope);

            $scope.account = Account.getAccount();
            $scope.updateable = ['email','firstName','lastName','companyName','address','postalCode','city','state','country','phone'];

            $scope.userPlatform = $window.navigator.platform;

            $scope.saving = false;

            $scope.updateAccount = function () {
                console.log('here');
                $scope.saving = true;
                Account.updateAccount($scope.account).then(function (newAccount) {
                    $scope.account = newAccount;
                    $scope.saving = false;
                }, function (err) {
                    $scope.saving = false;
                });

            };

        }]);
}(window.JP.getModule('Account')));