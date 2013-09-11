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

        function ($scope, requestContext, localization, rule, $q) {

            localization.bind('firewall', $scope);
            requestContext.setUpRenderContext('firewall.index', $scope);
            $scope.loading = true;

            $scope.rulesByDatacenter = {
            };

            $scope.datacenter = 'US-EAST';
            $scope.rules = $scope.rulesByDatacenter[$scope.datacenter].rules;

            $scope.targetTypes = [{
                value:'wildcard',
                title: 'any'
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
                value:'enabled',
                title:'Enabled'
            },{
                value:'disabled',
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

            $scope.$watch('datacenter', function(dc){
                if(dc) {
                    $scope.rules = $scope.rulesByDatacenter[$scope.datacenter].rules;
                }
            });

            $scope.data = {};
            $scope.resetData = function () {
                $scope.data.id = null;
                $scope.data.from = [['wildcard', 'any']];
                $scope.data.to = [['wildcard', 'any']];
                $scope.data.action = 'allow';
                $scope.data.protocol = {
                    name:'tcp',
                    targets:[]
                };
                $scope.data.status = 'disabled';
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
                $scope.data.protocol.targets.push($scope.currentPort);
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

                if($scope.data[direction].length == 1 && $scope.data[direction][0][0] == 'wildcard') {
                    $scope.data[direction] = [];
                }

                $scope.data[direction].push([type, data]);

                $scope.resetCurrent();
            }
            function clearTarget(direction) {
                $scope.data[direction] = [];
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
                $scope.data.from.splice(i, 1);
                if(!$scope.data.from.length) {
                    $scope.addAnyFrom();
                }
            }
            $scope.removeTo = function(i) {
                $scope.data.to.splice(i, 1);
                if(!$scope.data.to.length) {
                    $scope.addAnyTo();
                }
            }

        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
