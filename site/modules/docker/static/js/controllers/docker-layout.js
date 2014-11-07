'use strict';

(function (app) {
    app.controller(
        'docker.LayoutController',
        ['$scope', 'requestContext', 'Docker', '$rootScope',
            function ($scope, requestContext, Docker, $rootScope) {
                requestContext.setUpRenderContext('docker', $scope);

                if ($scope.features.docker === 'enabled') {
                    Docker.listHosts().then(function (hosts) {
                        $rootScope.dockerHostsAvailable = hosts.length > 0;
                    });
                }
            }
        ]);
}(window.JP.getModule('docker')));
