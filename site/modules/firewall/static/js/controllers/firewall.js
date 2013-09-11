'use strict';

(function (ng, app) {
    app.filter('targetInfo', function() {
        return function(target) {
            if(target[0] == 'wildcard' && target[1] == 'any') {
                return 'ANY';
            } else {
                if(target[0] == 'tag' && ng.isArray(target[1])) {
                    return target[0] + ': ' + target[1][0] + ' = ' + target[1][1];
                }else {
                    return target[0] + ': ' + target[1];
                }
            }
        }
    });
    app.controller('Firewall.IndexController', [
        '$scope',
        'requestContext',
        'localization',
        'rule',
        '$q',
        'Machine',

        function ($scope, requestContext, localization, rule, $q, Machine) {

            localization.bind('firewall', $scope);
            requestContext.setUpRenderContext('firewall.index', $scope);

            $scope.loading = true;
            $scope.vms = [];
            $scope.tags = [];

            function extractIDs(machines) {
                for(var m in machines) {
                    var machine = machines[m];
                    if(ng.isObject(machine)) {

                        if(Object.keys(machine.tags).length) {
                            for(var tag in machine.tags) {
                                if($scope.tags.indexOf(tag) === -1) {
                                    $scope.tags.push(tag);
                                }
                            }
                        }
                        $scope.vms.push(machine.id)
                    }
                }

            }


            $scope.machines = Machine.machine();
            $scope.rulesByDatacenter = rule.rule();
            $q.all([
                $q.when($scope.machines),
                $q.when($scope.rulesByDatacenter)
            ]).then(function(lists){
                $scope.loading = false;

                $scope.$watch('datacenter', function(dc){
                    if(dc) {

                        $scope.rules = lists[1][$scope.datacenter];

                        if(lists[0].length) {
                            extractIDs(lists[0]);
                        }
                    }
                });
            });

            $scope.datacenter = 'us-beta-4';

            $scope.targetTypes = [{
                value:'wildcard',
                title: 'Any'
            },{
                value:'ip',
                title: 'IP'
            }, {
                value:'subnet',
                title:'Subnet'
            }, {
                value:'tag',
                title:'Tag'
            }, {
                value:'vm',
                title:'Vm'
            }];

            $scope.actions = [{
                value:'allow',
                title:'Allow'
            },{
                value:'block',
                title:'Block'
            }];

            $scope.states = [{
                value: true,
                title:'Enabled'
            },{
                value: false,
                title:'Disabled'
            }];

            $scope.protocols = [{
                value:'tcp',
                title:'TCP'
            },{
                value:'udp',
                title:'UDP'
            },{
                value:'icmp',
                title:'ICMP'
            }];



            $scope.data = {};
            $scope.resetData = function () {
                $scope.data.id = null;
                $scope.data.datacenter = $scope.datacenter;
                $scope.data.parsed = {};
                $scope.data.parsed.from = [['wildcard', 'any']];
                $scope.data.parsed.to = [['wildcard', 'any']];
                $scope.data.parsed.action = 'allow';
                $scope.data.parsed.protocol = {
                    name:'tcp',
                    targets:[]
                };
                $scope.data.enabled = false;
            };
            $scope.resetData();

            $scope.current = {};
            $scope.resetCurrent = function() {
                $scope.current.from = null;
                $scope.current.fromType = 'wildcard';
                $scope.current.to = null;
                $scope.current.toType = 'wildcard';
                $scope.current.toTagValue = null;
                $scope.current.fromTagValue = null;
            }
            $scope.resetCurrent();

            $scope.currentPort = null;

            $scope.addPort =function() {
                $scope.data.parsed.protocol.targets.push($scope.currentPort);
                $scope.currentPort = null;
            }

            function addTarget(direction) {
                var data = $scope.current[direction];
                var type = $scope.current[direction + 'Type'];
                var tagValue = $scope.current[direction + 'TagValue'];
                if(type == 'wildcard') {
                    clearTarget(direction);
                    data = 'any';
                } else if (type == 'tag' && tagValue) {
                    data = [data, tagValue];
                }

                if($scope.data.parsed[direction].length == 1 && $scope.data.parsed[direction][0][0] == 'wildcard') {
                    $scope.data.parsed[direction] = [];
                }

                $scope.data.parsed[direction].push([type, data]);

                $scope.resetCurrent();
            }
            function clearTarget(direction) {
                $scope.data.parsed[direction] = [];
            }
            $scope.addFrom = function() {
                addTarget('from');
            }
            $scope.addAnyFrom = function() {
                clearTarget('from');
                addTarget('from');
            }
            $scope.addTo = function() {
                addTarget('to');
            }
            $scope.addAnyTo = function() {
                clearTarget('to');
                addTarget('to');
            }
            $scope.removeFrom = function(i) {
                $scope.data.parsed.from.splice(i, 1);
                if(!$scope.data.parsed.from.length) {
                    $scope.addAnyFrom();
                }
            }
            $scope.removeTo = function(i) {
                $scope.data.parsed.to.splice(i, 1);
                if(!$scope.data.parsed.to.length) {
                    $scope.addAnyTo();
                }
            }

            $scope.createRule = function() {
                var rulePromise = rule.createRule($scope.data);
                $q.when(rulePromise).then(function(){
                    console.log('argh', arguments);
                })
            }

            $scope.editRule = function(r) {
                $scope.data.id = r.id;
                $scope.data.datacenter = r.datacenter;
                $scope.data.parsed = {
                    from: r.parsed.from,
                    to: r.parsed.to,
                    action: r.parsed.action,
                    protocol: r.parsed.protocol
                };
                $scope.data.enabled = r.enabled;
            }
            $scope.deleteRule = function(r) {
                console.log('delete rule', r.id);
            }

        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
