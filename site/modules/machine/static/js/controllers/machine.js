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
                $$track.page();

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
                $scope.packages = packages;

                $scope.clickStart = function () {
                    $$track.event("machine", "start");
                    confirm("Are you sure you want to start the machine", function () {
                        $scope.retinfo = Machines.startMachine(machineid);
                    });
                }

                $scope.clickStop = function () {
                    $$track.event("machine", "stop");
                    confirm("Are you sure you want to stop the machine", function () {
                        $scope.retinfo = Machines.stopMachine(machineid);
                    });
                }

                $scope.clickReboot = function () {
                    $$track.event("machine", "reboot");

                    confirm("Are you sure you want to reboot the machine", function () {
                        $scope.retinfo = Machines.rebootMachine(machineid);
                    });
                }

                $scope.clickResize = function () {
                    $$track.event("machine", "resize");

                    confirm("Are you sure you want to resize the machine", function () {
                        $scope.retinfo = Machines.resizeMachine(machineid, $scope.resize);
                    });
                }

            }

        ]);
}(window.JP.getModule('Machine')));