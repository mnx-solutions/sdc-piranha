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

            return service;
        }]);
}(window.JP.getModule('elb')));