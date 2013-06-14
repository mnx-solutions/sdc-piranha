'use strict';

(function (app) {
    app.controller(
        'StorageController',
        ['$scope', 'Account', 'requestContext', '$q', 'localization', function ($scope, Account, requestContext, $q, localization) {
            localization.bind('storage', $scope);
            requestContext.setUpRenderContext('storage.index', $scope);

            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys(true);

            $scope.loading = true;


        }]);
}(window.JP.getModule('Storage')));