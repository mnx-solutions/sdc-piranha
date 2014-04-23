'use strict';

(function (app) {
    app.controller(
        'Storage.JobBuilderController',
        ['$scope', 'requestContext', 'localization',
            function ($scope, requestContext, localization) {
                localization.bind('storage', $scope);
                requestContext.setUpRenderContext('storage.builder', $scope);

                $scope.jobName = '';
                $scope.dataInputs = [];
                $scope.dataAssets = [];
                $scope.filePath = '';
            }]
    );
}(window.JP.getModule('Storage')));
