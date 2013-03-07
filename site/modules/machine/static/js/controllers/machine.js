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

    $scope.clickStart = function(uuid) {
        $scope.retinfo = MachineInfo.startMachine(uuid);
    }

    $scope.clickStop = function(uuid) {
        $scope.retinfo = MachineInfo.stopMachine(uuid);
    }

    $scope.clickReboot = function(uuid) {
        $scope.retinfo = MachineInfo.rebootMachine(uuid);
    }
}

        ]);
}(window.JP.getModule('Machine')));