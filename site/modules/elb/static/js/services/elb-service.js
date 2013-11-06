'use strict';

(function (app) {
    app.factory('elb.Service', [
        'serverTab',
        '$http',
        '$q',
        function (serverTab, $http, $q) {
            var service = {};

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
                var d = $q.defer();
                serverTab.call({
                    name: 'SscMachineLoad',
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

            service.createController = function createController(datacenter) {
                var d = $q.defer();
                serverTab.call({
                    name: 'SscMachineCreate',
                    data: {
                        datacenter: datacenter
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

            service.deleteController = function deleteController() {
                var d = $q.defer();
                serverTab.call({
                    name: 'SscMachineDelete',
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
            return service;
        }]);
}(window.JP.getModule('elb')));