'use strict';

(function (app) {
    app.controller(
        'Storage.FilemanController',
        ['$scope', 'requestContext', 'localization', 'Storage', '$location', 'Account',
            function ($scope, requestContext, localization, Storage, $location, Account) {
                localization.bind('storage', $scope);
                $scope.filePath = '';
                requestContext.setUpRenderContext('storage.fileman', $scope);
                Account.getAccount().then(function (account) {
                    if (account.provisionEnabled) {
                        Storage.ping().then(angular.noop, function () {
                            $scope.popup = true;
                            $location.url('/manta/intro');
                            $location.replace();
                        });
                    }
                });
            }]
    );
}(window.JP.getModule('Storage')));
