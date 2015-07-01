'use strict';

(function (app) {
    app.controller('Machine.DetailsController', [
        '$scope',
        'requestContext',
        'localization',
        'Machine',
        'Docker',

        function ($scope, requestContext, localization, Machine, Docker) {
            function setMachine(machine) {
                $scope.machine = machine;
                $scope.containerDetailsAvailable = $scope.machine.tags && $scope.machine.tags.sdc_docker && $scope.features.sdcDocker !== 'disabled' && $scope.features.docker === 'enabled';
                if ($scope.machine.tags && $scope.machine.tags.sdc_docker) {
                    Docker.hasLinkedContainers($scope.machine).then(function (res) {
                        $scope.isLinkedContainer = res;
                    });
                }
            }
            var machineid = requestContext.getParam('machineid') || util.idToUuid(requestContext.getParam('containerid'));
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.details', $scope, {
                title: localization.translate(null, 'machine', 'View Joyent Instance Details')
            });
            $scope.tabs = ['Infrastructure Details', 'Docker Details'];
            $scope.activeTab = $scope.tabs[0];
            var tryMachine = Machine.machine(machineid);

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
