'use strict';

(function (app) {
    app.controller(
        'MachineController',
        [   '$scope',
            'requestContext',
            'MachineInfo',

function ($scope, requestContext, MachineInfo) {
    requestContext.setUpRenderContext('machine.details', $scope);
    var machineid = requestContext.getParam('machineid');
    $scope.machineid = machineid;

    var selectedmachine = MachineInfo.getMachine(machineid);
    $scope.selectedmachine = selectedmachine;
}

        ]);
}(window.JP.getModule('Machine')));