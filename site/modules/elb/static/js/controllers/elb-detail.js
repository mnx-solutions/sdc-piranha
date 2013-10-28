'use strict';

(function (app) {
    app.controller('elb.DetailController',
        ['$scope', 'requestContext', 'localization', 'elb.Service', '$location', '$q',
            function ($scope, requestContext, localization, service, $location, $q) {
                localization.bind('elb', $scope);
                requestContext.setUpRenderContext('elb.detail', $scope, {
                    title: localization.translate(null, 'elb', 'Load Balancer Details')
                });

	            //FIXME: We do not use comma separated declaration. Each var separately!
                var balancerId = requestContext.getParam('balancerId'), traffic = {
                    inbound: [{x: 0, y: 0}],
                    outbound: [{x: 0, y: 0}]
                };
                $scope.detailLoaded = false;
                $scope.server = {};

                function prepareTrafficData(data, key, collector) {
                    collector.splice(0);

                    data.forEach(function (day) {
                        var date = new Date(day.date);
                        day[key].slice(-8).forEach(function (value, hour) {
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
	                //FIXME: We do not use comma separated declaration. Each var separately!
                    var hostNames = {}, machines = results[1][0].machines, usage = results[2];

                    prepareTrafficData(usage[0].slice(-1), 'bytesin', traffic.inbound);
                    prepareTrafficData(usage[1].slice(-1), 'bytesout', traffic.outbound);
                    $scope.traffic = traffic;

                    //FIXME: Readability
                    //FIXME: Doesn't this run the risk of things being overwritten?
                    machines.forEach(function (machine) {
                        hostNames[machine.primaryIp] = machine.name;
                        hostNames[machine.name] = machine.id;
                        hostNames[machine.dc] = machine.datacenter;
                    });
	                //FIXME: Readibility
                    $scope.server.machines = ($scope.server.machines || []).map(function (machine) {
                        machine.name = hostNames[machine.host] || '';
                        machine.id = hostNames[machine.name] || '';
                        machine.datacenter = hostNames[machine.dc] || '';
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
