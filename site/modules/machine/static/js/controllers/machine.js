'use strict';

(function (app) {
    app.controller(
        'MachineController',
        [   '$scope',
            '$filter',
            'requestContext',
            'Machines',
            "$dialog",
            "$$track",
            function ($scope, $filter, requestContext, Machines, $dialog, $$track) {

                requestContext.setUpRenderContext('machine.details', $scope);
                var machineid = requestContext.getParam('machineid');

                var confirm = function (question, callback) {
                    var title = 'Confirm';
                    var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                    $dialog.messageBox(title, question, btns)
                        .open()
                        .then(function(result){
                            if(result=='ok'){
                                callback();
                            }
                        });
                };

                $scope.machineid = machineid;

                var selectedmachine = Machines.getMachine(machineid);
                $scope.selectedmachine = selectedmachine;

                var packages = Machines.getPackages();
                $scope.selectedmachine.then(function(value){
                    $scope.package = Machines.getPackage(value.package);
                });

                $scope.packages = packages;

                $scope.clickStart = function () {
                    confirm("Are you sure you want to start the machine", function () {
                        $$track.event("machine", "start");
                        var job = Machines.startMachine(machineid);
                        job.name = "starting"
                    });
                }

                $scope.clickStop = function () {
                    confirm("Are you sure you want to stop the machine", function () {
                        var job = Machines.stopMachine(machineid);
                        $$track.event("machine", "stop");
                        job.name = "stopping"
                    });
                }

                $scope.clickReboot = function () {
                    confirm("Are you sure you want to reboot the machine", function () {
                        $$track.event("machine", "reboot");
                        var job  = Machines.rebootMachine(machineid);
                        job.name = "rebooting"
                    });
                }

                $scope.clickResize = function () {
                    confirm("Are you sure you want to resize the machine", function () {
                        $$track.event("machine", "resize");
                        $scope.retinfo = Machines.resizeMachine(machineid, $scope.resize);
                    });
                }

                $scope.clickDelete = function () {
                    confirm("Are you sure you want to delete the machine", function () {
                        $$track.event("machine", "delete");
                        $scope.retinfo = Machines.deleteMachine(machineid);
                    });
                }

            }

        ]);
}(window.JP.getModule('Machine')));