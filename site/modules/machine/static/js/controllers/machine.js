'use strict';

(function (app) {
    app.controller('Machine.DetailsController', [
        '$scope',
        'requestContext',
        'localization',
        'Machine',
        'Docker',
        'util',
        function ($scope, requestContext, localization, Machine, Docker, util) {
            function setMachine(machine) {
                Machine.checkMachineExists(machine).then(function () {
                    $scope.machine = machine;
                    $scope.containerDetailsAvailable = $scope.machine.tags && $scope.machine.tags['sdc_docker'] &&
                        $scope.features.sdcDocker !== 'disabled' && $scope.features.docker === 'enabled';

                    if ($scope.containerDetailsAvailable && $scope.machine.state !== 'deleting') {
                        Docker.hasLinkedContainers($scope.machine).then(function (res) {
                            $scope.isLinkedContainer = res;
                        });
                    }
                });
            }
            var machineId = requestContext.getParam('machineid') || util.idToUuid(requestContext.getParam('containerid'));
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View ' + $scope.company.name + ' Instance Details')
            });
            $scope.tabs = ['Infrastructure Details', 'Docker Details'];
            $scope.activeTab = $scope.tabs[0];
            var tryMachine = Machine.machine(machineId);

            if (typeof tryMachine.then === 'function') {
                tryMachine.then(function (machine) {
                    setMachine(machine);
                });
            } else {
                setMachine(tryMachine);
            }
        }

    ]);
}(window.JP.getModule('Machine')));
