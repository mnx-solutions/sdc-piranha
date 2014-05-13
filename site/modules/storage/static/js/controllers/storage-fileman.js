'use strict';

(function (app) {
    app.controller(
        'Storage.FilemanController',
        ['$scope', 'requestContext', 'localization', 'Storage', '$location',
            function ($scope, requestContext, localization, Storage, $location) {
                localization.bind('storage', $scope);
                $scope.filePath = '';
                requestContext.setUpRenderContext('storage.fileman', $scope);
                Storage.ping().then(angular.noop, function () {
                    $scope.popup = true;
                    $location.url('/manta/intro');
                    $location.replace();
                });
            }]
    );
}(window.JP.getModule('Storage')));
