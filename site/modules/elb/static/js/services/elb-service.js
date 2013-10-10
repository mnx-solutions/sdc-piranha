'use strict';

(function (app) {
    app.factory('elb.Service', [
        'serverTab',
        '$http',
        '$q',
        function (serverTab, $http, $q) {
            var service = {};

            function _filterBalancer(balancer) {
                balancer.machinesUp = (balancer.machines || []).filter(function (machine) {
                    return machine.status === 'up';
                });
                return balancer;
            }

            service.getBalancer = function getBalancer(balancerId) {
                var d = $q.defer();
                $http.get('elb/item/' + (balancerId || '')).success(function (data) {
                    d.resolve(_filterBalancer(data));
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            };

            service.updateBalancer = function updateBalancer(balancerId, data) {
                var d = $q.defer();
                $http.put('elb/item/' + balancerId, data).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            };

            service.addBalancer = function addBalancer(data) {
                var d = $q.defer();
                $http.post('elb/item', data).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            };

            service.deleteBalancer = function deleteBalancer(balancerId) {
                var d = $q.defer();
                $http.delete('elb/item/' + balancerId).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
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
                $http.get('elb/list').success(function (data) {
                    data = data.map(function (balancer) {
                        return _filterBalancer(balancer);
                    });
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            };

            service.addMachine = function addMachine(balancerId, host) {
                var d = $q.defer();
                $http.put('elb/item/' + balancerId + '/machines/' + encodeURIComponent(host)).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            };

            service.deleteMachine = function deleteMachine(balancerId, host) {
                var d = $q.defer();
                $http.delete('elb/item/' + balancerId + '/machines/' + encodeURIComponent(host)).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                        d.reject(err);
                    });
                return d.promise;
            };

            service.getController = function getController() {
                var d = $q.defer();
                d.resolve(localStorage['hasElbController'] === 'yes');
                return d.promise;
            }

            service.createController = function createController() {
                var d = $q.defer();
                localStorage['hasElbController'] = 'yes';
                d.resolve();
                return d.promise;
            };

            service.deleteController = function deleteController() {
                var d = $q.defer();
                localStorage['hasElbController'] = 'no';
                d.resolve();
                return d.promise;
            };

            function _createController() {
                var data = {
                    name: 'ELBController',
                    package: 'd6987187-e4c6-4e89-990c-cd314c216add', // TODO: Change minimal Ubuntu package to STM when ready
                    networks: ['7cb0dfa0-a5a5-4533-86dc-dedbe6bb662f']
                };
                serverTab.createMachine(data, function (err, machine) {
                    if (err) {
                        d.reject(err);
                        return;
                    }
                    d.resolve(machine);
                });
            }

            return service;
        }]);
}(window.JP.getModule('elb')));