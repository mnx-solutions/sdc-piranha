'use strict';

(function (app) {
    app.factory('elb.Service', [
        'serverTab',
        '$http',
        '$q',
        function (serverTab, $http, $q) {
            function _filterBalancer(balancer) {
                balancer.machinesUp = (balancer.machines || []).filter(function (machine) {
                    return machine.status === 'up';
                });
                return balancer;
            }

            function getBalancer(balancerId) {
                var d = $q.defer();
                $http.get('elb/item/' + (balancerId || '')).success(function (data) {
                    d.resolve(_filterBalancer(data));
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            }

            function updateBalancer(balancerId, data) {
                var d = $q.defer();
                $http.put('elb/item/' + balancerId, data).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            }

            function addBalancer(data) {
                var d = $q.defer();
                $http.post('elb/item', data).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            }

            function getMachines() {
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
            }

            function getBalancers() {
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
            }

            function addMachine(balancerId, host) {
                var d = $q.defer();
                $http.put('elb/item/' + balancerId + '/machines/' + encodeURIComponent(host)).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            }

            function deleteMachine(balancerId, host) {
                var d = $q.defer();
                $http.delete('elb/item/' + balancerId + '/machines/' + encodeURIComponent(host)).success(function (data) {
                    d.resolve(data);
                }).error(function (err) {
                        d.reject(err);
                    });
                return d.promise;
            }

            return {
                getBalancer: getBalancer,
                addBalancer: addBalancer,
                updateBalancer: updateBalancer,
                getBalancers: getBalancers,
                getMachines: getMachines,
                addMachine: addMachine,
                deleteMachine: deleteMachine
            };
        }]);
}(window.JP.getModule('elb')));