'use strict';

(function (app) {
    app.controller(
        'docker.LayoutController',
        ['$scope', 'requestContext', 'Docker', '$rootScope', 'Account',
            function ($scope, requestContext, Docker, $rootScope, Account) {
                requestContext.setUpRenderContext('docker', $scope);

                if ($scope.features.docker === 'enabled') {
                    Account.getAccount().then(function (account) {
                        $rootScope.provisionEnabled = account.provisionEnabled;
                    });
                    Docker.listHosts().then(function (hosts) {
                        $rootScope.dockerHostsAvailable = hosts.length > 0;
                    });
                }
            }
        ]);
}(window.JP.getModule('docker')));
