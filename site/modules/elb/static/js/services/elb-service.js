'use strict';

(function (app) {
    app.factory('elb.Service', [
        'serverTab',
        '$http',
        '$q',
        function (serverTab, $http, $q) {
            function getBalancer(balancerId) {
                var d = $q.defer();
                $http.get('elb/item/' + (balancerId || '')).success(function (data) {
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
                    d.resolve(data);
                }).error(function (err) {
                    d.reject(err);
                });
                return d.promise;
            }
            return {getBalancer: getBalancer, getBalancers: getBalancers, getMachines: getMachines};
        }]);
}(window.JP.getModule('elb')));