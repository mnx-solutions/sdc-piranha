'use strict';

(function (ng, app) {
    app.controller('Machine.IndexController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$dialog',
        '$q',
        'requestContext',
        'Machine',
        'Dataset',
        'Package',
        'localization',
        'util',
        '$http',

        function ($scope, $cookieStore, $filter, $$track, $dialog, $q, requestContext, Machine, Dataset, Package, localization, util, $http) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.index', $scope, {
                title: localization.translate(null, 'machine', 'See my Joyent Instances')
            });

//            $scope.listTypes = [ 'normal', 'alternate', 'grid'];
//            $scope.listType = $scope.listTypes[0]; // Defaults to 'normal'

            $scope.listType = 'grid';

            $scope.loading = true;

            // Pagination
            $scope.machines = Machine.machine();
            $scope.packages = Package.package();

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.machines = Machine.machine();
                }
            );

            $scope.$watch('machines', function (machines) {
                machines.forEach(function (machine) {
                    machine.label = machine.name || machine.id;
                });
            }, true);

            $scope.$watch('machines.final', function (final) {
                if(final) {
                    $q.when($scope.packages, function () {
                        $scope.loading = false;
                    });
                }
            });


            /* export current machines */
            $scope.exportDetails = function() {
                var order = [];
                var ignoredValues = ['metadata'];
                var exportData = $scope.machines;

                if ($scope.machines[0]) {
                    Object.keys($scope.machines[0]).forEach(function(key) {
                        // if it's not an ignored field
                        if (ignoredValues.indexOf(key) === -1) {
                            order.push(key);
                        }
                    });
                }

                // filter out ignored fields
                exportData.forEach(function(el) {
                    ignoredValues.forEach(function(e) {
                        delete el[e];
                    });
                });

                $http.post('machine/export', {data: exportData, order: order})
                    .success(function (id) {
                        $scope.exportIframe = '<iframe src="machine/export/' + id + '/csv"></iframe>';
                    })
                    .error(function () {
                        console.error('err', arguments);
                    });
            };

            $scope.startMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Start instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance'
                    ), function () {
                        $$track.event('machine', 'start');
                        Machine.startMachine(id);
                    });
            };

            $scope.stopMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Stop instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Stopping an instance does not stop billing, your instance can be restarted after it is stopped.'
                    ), function () {
                        Machine.stopMachine(id);
                        $$track.event('machine', 'stop');
                    });
            };

            $scope.deleteMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Destroy the information on this instance and stop billing for this instance.'
                    ), function () {
                        $$track.event('machine', 'delete');
                        Machine.deleteMachine(id);
                    });
            };

            $scope.rebootMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Restart instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance'
                    ), function() {
                        $$track.event('machine', 'reboot');
                        Machine.rebootMachine(id);
                    });
            };

            $scope.gridOrder = [];
            $scope.gridProps = [
                {
                    id: 'label',
                    name: 'Name',
                    sequence: 1
                },
                {
                    id: 'datacenter',
                    name: 'Datacenter',
                    sequence: 2
                },
                {
                    id: 'created',
                    name: 'Created at',
                    sequence: 3
                },
                {
                    id: 'ips',
                    name: 'IP-s',
                    sequence: 4
                },
                {
                    id: 'state',
                    name: 'Status',
                    sequence: 5
                }
            ];
            $scope.gridDetailProps = [
                {
                    id: 'memory',
                    name: 'Memory',
                    sequence: 1
                },
                {
                    id: 'disk',
                    name: 'Disk',
                    sequence: 2
                },
                {
                    id: '_Dataset',
                    id2: 'name',
                    name: "Image name",
                    sequence: 3
                },
                {
                    id: 'ips',
                    name: 'IP-s',
                    sequence: 4
                }
            ];

            $scope.gridActionButtons = [
                {
                    label: 'Start',
                    disabled: function (object) {
                        return object.state == 'running' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.startMachine(object.id);
                    },
                    tooltip: 'Instance configuration and data is preserved when instances are stopped. Use start to restart your instance.',
                    sequence: 1
                },
                {
                    label: 'Stop',
                    disabled: function (object) {
                        return object.state == 'stopped' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.stopMachine(object.id);
                    },
                    tooltip: 'Stopping an instance does not stop billing. You can restart your instance after you stop your machine.',
                    sequence: 2
                },
                {
                    label: 'Delete',
                    disabled: function (object) {
                        return object.state != 'stopped' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.deleteMachine(object.id);
                    },
                    tooltip: 'You will lose all information and data on this instance if you delete an instance. Deleting an instance also stops billing.',
                    sequence: 3
                },
                {
                    label: 'Reboot',
                    disabled: function (object) {
                        return object.state !== 'running' || (object.job && !object.job.finished);
                    },
                    action: function (object) {
                        $scope.rebootMachine(object.id);
                    },
                    tooltip: 'Click here to reboot your instance.',
                    sequence: 4
                }
            ];

        }


    ]);
}(window.angular, window.JP.getModule('Machine')));
