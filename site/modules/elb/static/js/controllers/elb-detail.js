'use strict';

(function (app) {
    app.controller('elb.DetailController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', '$location', '$q',
            function ($scope, requestContext, localization, service, $location, $q) {
                localization.bind('elb', $scope);
                requestContext.setUpRenderContext('elb.detail', $scope, {
                    title: localization.translate(null, 'elb', 'Load Balancer Details')
                });

                var balancerId = requestContext.getParam('balancerId');
                var traffic = {
                    inbound: [{x: 0, y: 0}],
                    outbound: [{x: 0, y: 0}]
                };
                $scope.detailLoaded = false;
                $scope.server = {};

                function prepareTrafficData(data, key, collector) {
                    collector.splice(0);

                    data.forEach(function (day) {
                        var date = new Date(day.date);
                        day[key].forEach(function (value, hour) {
                            collector.push({
                                x: date.setHours(hour) / 1000,
                                y: value
                            });
                        });
                    });
                    return collector;
                }

                $q.all([service.getBalancer(balancerId), service.getMachines(),
                        service.getBalancerUsage(balancerId)]).then(function (results) {
                    $scope.server = results[0];
                    var machines = results[1][0].machines;
                    var usage = results[2];

                    prepareTrafficData(usage[0].slice(-1), 'bytesin', traffic.inbound);
                    prepareTrafficData(usage[1].slice(-1), 'bytesout', traffic.outbound);
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
                        machine.details = hostDetails[machine.host];
                        return machine;
                    });
                    $scope.detailLoaded = true;
                });

                $scope.edit = function () {
                    $location.path('/elb/edit/' + balancerId);
                };

            }]
        );
}(window.JP.getModule('elb')));
