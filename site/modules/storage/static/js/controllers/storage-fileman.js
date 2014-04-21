'use strict';

(function (app) {
    app.controller(
        'Storage.FilemanController',
        ['$scope', 'requestContext', 'localization',
            function ($scope, requestContext, localization) {
                localization.bind('storage', $scope);
                $scope.filePath = '';
                requestContext.setUpRenderContext('storage.fileman', $scope);
            }]
    );
}(window.JP.getModule('Storage')));
