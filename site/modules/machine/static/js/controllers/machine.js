'use strict';

(function (app) {
    app.controller(
        'MachineController',
        [   '$scope',
            'requestContext',
            'Machines',

function ($scope, requestContext, Machines) {
    requestContext.setUpRenderContext('machine.details', $scope);
    var machineid = requestContext.getParam('machineid');
    $scope.machineid = machineid;
    var selectedmachine = Machines.getMachine(machineid);
    $scope.selectedmachine = selectedmachine;
}

        ]);
}(window.JP.getModule('Machine')));