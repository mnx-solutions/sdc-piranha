'use strict';

(function (app) {
    app.controller(
        'slb.EditController',
        ['$scope', 'requestContext', 'localization', '$location', 'PopupDialog', '$q', 'slb.Service', 'Datacenter', 'notification',
            function ($scope, requestContext, localization, $location, PopupDialog, $q, service, Datacenter, notification) {
                localization.bind('slb', $scope);

                $scope.balancerId = requestContext.getParam('balancerId');
                requestContext.setUpRenderContext('slb.edit', $scope, {
                    title: localization.translate(null, 'slb', ($scope.balancerId ? 'Edit' : 'Create') + ' Load Balancer')
                });
                $scope.server = {};
                $scope.hcDelays = [1, 3, 5, 10];
                $scope.timeouts = [1, 2, 5, 10, 20];
                $scope.allLoading = false;
                $scope.deletedCount = 0;

                function nextPort(port) {
                    while (service.busyPorts.indexOf(port) !== -1) {
                        port += 1;
                    }
                    return port;
                }

                $q.all([service.getBalancer($scope.balancerId), service.getBalancers(), service.getMachines()]).then(function (results) {
                    $scope.deletedCount = 0;
                    var server = results[0];
                    var balancers = results[1];
                    var machines = results[2];

                    // Set defaults
                    server.fromPort = server.fromPort || nextPort(80);
                    server.currentPort = +server.fromPort;
                    server.toPort = server.toPort || 80;
                    server.health = server.health || {};
                    server.health.timeout = server.health.timeout || 2;
                    server.health.delay = server.health.delay || 5;
                    server.health.failThreshold = server.health.failThreshold || 5;
                    server.machines = server.machines || [];

                    // temporary limitation
                    server.datacenter = 'us-west-1';

                    var slbMachines = server.machines.map(function (machine) {
                        $scope.deletedCount += machine.deleted = !machines.some(function (el) {
                            return el.ips.indexOf(machine.host) !== -1;
                        });

                        return machine.host;
                    });
                    var hosts = {};
                    balancers.forEach(function (balancer) {
                        (balancer.machines || []).forEach(function (machine) {
                            hosts[machine.host] = hosts[machine.host] || [];
                            hosts[machine.host].push({id: balancer.id, name: balancer.name});
                        });
                    });

                    $scope.server = server;
                    $scope.protocolSelect(server.protocol);
                    Datacenter.datacenter().then(function (datacenters) {
                        $scope.datacenters = datacenters;
                        $scope.datacenterSelect(server.datacenter);
                    });

                    $scope.machines = machines.map(function (machine) {
                        if (slbMachines.indexOf(machine.primaryIp) !== -1) {
                            machine.selected = true;
                        }
                        machine.balancers = hosts[machine.primaryIp] || [];
                        return machine;
                    });
                    $scope.allLoading = true;
                }, function () {
                    $location.path('/slb');
                });

                $scope.protocols = [
                    {name: 'HTTP', value: 'http'},
                    {name: 'HTTPS', value: 'https'},
                    {name: 'TCP', value: 'tcp'},
                    {name: 'TCPS', value: 'tcps'}
                ];

                $scope.protocolSelect = function (protocolValue) {
                    $scope.protocolSelected = $scope.protocols[0];
                    $scope.protocols.some(function (protocol) {
                        if (protocol.value === protocolValue) {
                            $scope.protocolSelected = protocol;
                            return true;
                        }
                        return false;
                    });
                };

                $scope.datacenterSelect = function (datacenterName) {
                    $scope.datacenterSelected = $scope.datacenters[0];
                    $scope.datacenters.some(function (datacenter) {
                        if (datacenter.name === datacenterName) {
                            $scope.datacenterSelected = datacenter;
                            return true;
                        }
                        return false;
                    });
                };

                $scope.hcDelaySelect = function (name) {
                    $scope.server.health.delay = name;
                };
                $scope.timeoutSelect = function (name) {
                    $scope.server.health.timeout = name;
                };

                $scope.validateSelected = function (machine) {
                    if (machine && !machine.primaryIp) {
                        PopupDialog.error(
                            localization.translate(
                                $scope,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                'Cannot select instance without IP address. Is it still provisioning?'
                            )
                        );
                        machine.selected = false;
                    }
                    $scope.hasMachineSelected = $scope.machines.some(function (machine) {
                        return machine.selected;
                    });
                };

                function isInteger(value, min, max) {
                    var parsedValue = parseInt(value, 10);
                    if (parsedValue.toString() !== value.toString() || (parsedValue % 1)) {
                        return false;
                    }
                    min = min || 1;
                    max = max || Infinity;
                    return parsedValue >= min && parsedValue <= max;
                }

                function isReservedPort(value) {
                    return [0, 22, 9070, 9080, 9090].indexOf(value) !== -1;
                }
                function isPortAlreadyUsed(value) {
                    return $scope.server.currentPort !== value && service.busyPorts.indexOf(value) !== -1;
                }
                function isPortValid(value, isInternal) {
                    if (!isInteger(value, 1, 65535)) {
                        return false;
                    }
                    value = parseInt(value, 10);
                    var reservedPort = !isInternal && isReservedPort(value);
                    var busyPort = !isInternal && isPortAlreadyUsed(value);
                    return !reservedPort && !busyPort;
                }

                $scope.validate = function () {
                    var validationMessage = null;
                    $scope.validateSelected();
                    if (!$scope.hasMachineSelected) {
                        validationMessage = 'You must select at least one machine.';
                    }
                    var formElements = {
                        failThreshold: 'Failure threshold',
                        toPort: 'Instances port',
                        name: 'Load balancer name'
                    };
                    if ($scope.editForm.fromPort.$invalid) {
                        var viewValue = $scope.editForm.fromPort.$viewValue;
                        var parsedValue = parseInt(viewValue, 10);
                        if (viewValue !== "0" && !isInteger(viewValue, 1, 65535)) {
                            validationMessage = 'Load balancer port is invalid.';
                        } else if (isReservedPort(parsedValue)) {
                            validationMessage = 'The port number is reserved.';
                        } else if (isPortAlreadyUsed(parsedValue)) {
                            validationMessage = 'A current limitation is additional load balancers use the same IP as the first. Therefore, each one must be listening at a different port. We are working to resolve this.';
                        }
                    }
                    for (var formElementName in formElements) {
                        if ($scope.editForm[formElementName].$invalid) {
                            validationMessage = formElements[formElementName] + ' is invalid.';
                        }
                    }
                    return validationMessage;
                };

                $scope.save = function () {
                    var validationMessage = $scope.validate();
                    if (validationMessage) {
                        PopupDialog.error(
                            localization.translate(
                                $scope,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                validationMessage
                            ),
                            function () {}
                        );
                        return;
                    }
                    $scope.saving = true;
                    $scope.server.protocol = $scope.protocolSelected.value;
                    $scope.server.datacenter = $scope.datacenterSelected.name;
                    $scope.server.machines = $scope.machines.filter(function (machine) {
                        return machine.selected;
                    }).map(function (machine) {
                        return machine.primaryIp;
                    });
                    var operations = [];
                    if ($scope.balancerId) {
                        operations.push(service.updateBalancer($scope.balancerId, $scope.server));
                    } else {
                        operations.push(service.addBalancer($scope.server));
                    }
                    $q.all(operations).then(function () {
                        $location.path('/slb/list');
                    }, function (err) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'slb',
                                err.message || err
                            ),
                            function () {}
                        );
                        $scope.saving = false;
                    });
                };

                $scope.checkInteger = function (controlName) {
                    var input = $scope.editForm[controlName];
                    var value = input.$viewValue;
                    input.$setValidity('field', isInteger(value));
                };
                
                $scope.validatePort = function (controlName, isInternal) {
                    var input = $scope.editForm[controlName];
                    input.$setValidity('field', isPortValid(input.$viewValue, isInternal));
                };

                $scope.delete = function () {
                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: Delete Load Balancer'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Are you sure you want to delete this load balancer? You will be charged for Simple Load Balancer until you uninstall the feature.'
                        ),
                        function () {
                            $scope.saving = true;
                            service.deleteBalancer($scope.balancerId).then(function () {
                                $location.path('/slb/list');
                            }, function (err) {
                                notification.replace('slb', { type: 'error' }, err);
                                $scope.saving = false;
                            });
                        }
                    );
                };
            }]
    );
}(window.JP.getModule('slb')));
