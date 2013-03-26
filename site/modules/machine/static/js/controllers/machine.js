'use strict';

(function (app) {
    app.controller(
        'MachineController',
        [   '$scope',
            'requestContext',
            'Machine',
            'Package',
            '$dialog',
            '$$track',
            'localization',

            function ($scope, requestContext, Machine, Package, $dialog, $$track, localization) {
                localization.bind('machine', $scope);
                requestContext.setUpRenderContext('machine.details', $scope);

                var machineid = requestContext.getParam('machineid');

                var confirm = function (question, callback) {
                    var title = 'Confirm';
                    var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                    $dialog.messageBox(title, question, btns)
                        .open()
                        .then(function(result){
                            if(result ==='ok'){
                                callback();
                            }
                        });
                };

                $scope.machineid = machineid;

                $scope.selectedmachine = Machine.machine(machineid);

                $scope.$on(
                    'event:forceUpdate',
                    function (){
                        Machine.updateMachines();
                        Machine.machine(machineid).then(function(m){
                            $scope.selectedmachine = m;
                        });
                    }
                );

                $scope.packages = Package.package();

                if ($scope.selectedmachine.id) {
                    $scope.package = Package.package($scope.selectedmachine.package);
                } else {
                    $scope.selectedmachine.then(function(value){
                        $scope.package = Package.package(value.package);
                    });
                }

                $scope.clickStart = function () {
                    confirm("Are you sure you want to start the machine", function () {
                        $$track.event("machine", "start");
                        var job = Machine.startMachine(machineid);
                    });
                };

                $scope.clickStop = function () {
                    confirm("Are you sure you want to stop the machine", function () {
                        var job = Machine.stopMachine(machineid);
                        $$track.event("machine", "stop");
                    });
                };

                $scope.clickReboot = function () {
                    confirm("Are you sure you want to reboot the machine", function () {
                        $$track.event("machine", "reboot");
                        var job  = Machine.rebootMachine(machineid);
                    });
                };

                $scope.clickResize = function () {
                    confirm("Are you sure you want to resize the machine", function () {
                        $$track.event("machine", "resize");
                        $scope.retinfo = Machine.resizeMachine(machineid, $scope.resize);
                    });
                };

                $scope.clickDelete = function () {
                    confirm("Are you sure you want to delete the machine", function () {
                        $$track.event("machine", "delete");
                        $scope.retinfo = Machine.deleteMachine(machineid);
                    });
                };

            }

        ]);
}(window.JP.getModule('Machine')));