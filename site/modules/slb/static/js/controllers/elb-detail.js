'use strict';

(function (app) {
    app.controller('slb.DetailController',
        ['$scope', 'requestContext', 'localization', 'slb.Service', '$location', '$q',
            function ($scope, requestContext, localization, service, $location, $q) {
                localization.bind('slb', $scope);
                requestContext.setUpRenderContext('slb.detail', $scope, {
                    title: localization.translate(null, 'slb', 'Load Balancer Details')
                });

                var balancerId = requestContext.getParam('balancerId');
                var traffic = {
                    inbound: [{x: 0, y: 0}],
                    outbound: [{x: 0, y: 0}]
                };
                $scope.detailLoaded = false;
                $scope.server = {};

                function prepareTrafficData(data) {
                    var trafficMap = {
                        bytesin: 'inbound',
                        bytesout: 'outbound'
                    };
                    for (var key in trafficMap) {
                        data.forEach(function (day) {
                            var date = new Date(day.date);
                            if (Array.isArray(day[key])) {
                                day[key].forEach(function (value, hour) {
                                    traffic[trafficMap[key]].push({
                                        x: date.setHours(hour) / 1000,
                                        y: value
                                    });
                                });
                            }
                        });
                    }
                }

                $q.all([service.getBalancer(balancerId), service.getMachines(),
                        service.getBalancerUsage(balancerId)]).then(function (results) {
                    $scope.server = results[0];
                    var machines = results[1];
                    var usage = results[2];
                    traffic.inbound.splice(0);
                    traffic.outbound.splice(0);
                    prepareTrafficData(usage[0].slice(-1));
                    prepareTrafficData(usage[1].slice(-1));
                    $scope.traffic = traffic;

                    var hostDetails = {};
                    machines.forEach(function (machine) {
                        hostDetails[machine.primaryIp] = {
                            id: machine.id,
                            name: machine.name,
                            datacenter: machine.datacenter
                        };
                    });
                    $scope.server.machines = ($scope.server.machines || []).map(function (machine) {
                        machine.deleted = !machines.some(function (el) {
                            return el.ips.indexOf(machine.host) !== -1;
                        });
                        machine.details = hostDetails[machine.host];
                        return machine;
                    });
                    $scope.detailLoaded = true;
                });

                $scope.edit = function () {
                    $location.path('/slb/edit/' + balancerId);
                };

            }]
        );
}(window.JP.getModule('slb')));
