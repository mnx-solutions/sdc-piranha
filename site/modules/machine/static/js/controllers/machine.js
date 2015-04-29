'use strict';

(function (app) {
    app.controller('Machine.DetailsController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View Joyent Instance Details')
            });
            $scope.tabs = ['Summary', 'Docker Summary'];
            $scope.activeTab = $scope.tabs[0];
        }

    ]);
}(window.JP.getModule('Machine')));
