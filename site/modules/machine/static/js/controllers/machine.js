'use strict';

(function (app) {
    app.controller('Machine.DetailsController', [
        '$scope',
        'requestContext',
        'localization',
        'Machine',

        function ($scope, requestContext, localization, Machine) {
            var machineid = requestContext.getParam('machineid') || util.idToUuid(requestContext.getParam('containerid'));
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View Joyent Instance Details')
            });
            $scope.tabs = ['Infrastructure Details', 'Docker Details'];
            $scope.activeTab = $scope.tabs[0];
            $scope.machine = Machine.machine(machineid);
            $scope.containerDetailsAvailable = $scope.machine.tags && $scope.machine.tags.sdc_docker && $scope.features.docker !== 'disabled' ;
        }

    ]);
}(window.JP.getModule('Machine')));
