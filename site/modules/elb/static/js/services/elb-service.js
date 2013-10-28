'use strict';

(function (app) {
    app.factory('elb.Service', [
        'serverTab',
        '$http',
        '$q',
        function (serverTab, $http, $q) {
            var service = {};
            //TODO: Remove datacenter hardcode once we have UI selection for it
            var hardDataCenter = 'us-west-x';

            function filterBalancer(balancer) {
                balancer.machinesUp = (balancer.machines || []).filter(function (machine) {
                    return machine.status === 'up';
                });
                return balancer;
            }



            service.getBalancer = function getBalancer(balancerId) {
                var d = $q.defer();
                serverTab.call({
                    name: 'LoadBalancerLoad',
                    data: {
                        id: balancerId
                    },
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(filterBalancer(job.__read()));
                    }
                });
                return d.promise;
            };

            service.updateBalancer = function updateBalancer(balancerId, data) {
                var d = $q.defer();
                data.id = balancerId;
                serverTab.call({
                    name: 'LoadBalancerUpdate',
                    data: data,
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(job.__read());
                    }
                });
                return d.promise;
            };

            service.addBalancer = function addBalancer(data) {
                var d = $q.defer();
                serverTab.call({
                    name: 'LoadBalancerAdd',
                    data: data,
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(job.__read());
                    }
                });
                return d.promise;
            };

            service.deleteBalancer = function deleteBalancer(balancerId) {
                var d = $q.defer();
                serverTab.call({
                    name: 'LoadBalancerDelete',
                    data: {
                        id: balancerId
                    },
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(job.__read());
                    }
                });
                return d.promise;
            };

            service.getBalancerUsage = function getBalancerUsage(balancerId) {
                var d = $q.defer();
                serverTab.call({
                    name: 'LoadBalancerUsage',
                    data: {
                        id: balancerId
                    },
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(job.__read());
                    }
                });
                return d.promise;
            };

            service.getMachines = function getMachines() {
                var d = $q.defer();
                serverTab.call({
                    name: 'MachineList',
                    progress: function machineProgress(err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(job.__read());
                    }
                });
                return d.promise;
            };

            service.getBalancers = function getBalancers() {
                var d = $q.defer();
                serverTab.call({
                    name: 'LoadBalancersList',
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        var balancers = job.__read().map(function (balancer) {
                            return filterBalancer(balancer);
                        });
                        d.resolve(balancers);
                    }
                });
                return d.promise;
            };

            service.addMachine = function addMachine(balancerId, host) {
                var d = $q.defer();
                serverTab.call({
                    name: 'LoadBalancerMachineAdd',
                    data: {
                        id: balancerId,
                        host: host
                    },
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(job.__read());
                    }
                });
                return d.promise;
            };

            service.deleteMachine = function deleteMachine(balancerId, host) {
                var d = $q.defer();
                serverTab.call({
                    name: 'LoadBalancerMachineDelete',
                    data: {
                        id: balancerId,
                        host: host
                    },
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve(job.__read());
                    }
                });
                return d.promise;
            };

            service.getController = function getController() {
                return this.getMachines().then(function (result) {
                    return result[0].machines.some(function (machine) {
                        return machine.name === 'ELBController';
                    });
                });
            };

            service.createController = function createController() {
                var d = $q.defer();
                //TODO: Change minimal Ubuntu package to STM when ready
                var data = {
                    datacenter: hardDataCenter,
                    dataset: 'd2ba0f30-bbe8-11e2-a9a2-6bc116856d85',
                    name: 'ELBController',
                    package: 'd6987187-e4c6-4e89-990c-cd314c216add',
                    networks: ['7cb0dfa0-a5a5-4533-86dc-dedbe6bb662f']
                };
                serverTab.call({
                    name: 'MachineCreate',
                    data: data,
                    done: function (err, job) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        var result = job.__read();
                        d.resolve(result);
                    },
                    error: function (err, job) {
                        d.reject(err);
                        return;
                    }
                });
                return d.promise;
            };

            service.deleteController = function deleteController() {
                var d = $q.defer();
                this.getMachines().then(function (result) {
                    //TODO: Get machine by special package type rather than hardcoded name once image is ready
                    var controllerMachines = result[0].machines.filter(function (machine) {
                        return machine.name === 'ELBController';
                    });
                    if (!controllerMachines.length) {
                        d.reject('Controller not found');
                    }
                    var controllerId = controllerMachines[0].id;
                    serverTab.call({
                        name: 'MachineStop',
                        data: {
                            uuid: controllerId,
                            datacenter: hardDataCenter
                        },
                        done: function (err, job) {
                            if (err) {
                                d.reject(err);
                                return;
                            }
                            serverTab.call({
                                name: 'MachineDelete',
                                data: {
                                    uuid: controllerId,
                                    datacenter: hardDataCenter
                                },
                                done: function (err, job) {
                                    if (err) {
                                        d.reject(err);
                                        return;
                                    }
                                    d.resolve();
                                }
                            });
                        }
                    });
                });
                return d.promise;
            };
            return service;
        }]);
}(window.JP.getModule('elb')));