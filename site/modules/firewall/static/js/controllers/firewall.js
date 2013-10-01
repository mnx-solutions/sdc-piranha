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

            var MAX_IN_DROPDOWN = 3; // maximum Vms and Tags in default dropdown

            function query(options){

                var results = [];
                if(options.term == "") {

                    results = ng.copy($scope.dropdown);

                    if(results[1].children.length > MAX_IN_DROPDOWN) {
                        results[1].children.splice(MAX_IN_DROPDOWN);
                    }
                    if(results[2].children.length > MAX_IN_DROPDOWN) {
                        results[2].children.splice(MAX_IN_DROPDOWN);
                    }

                } else {
                    var vms = $.grep($scope.vms, function(vm){
                        return (vm.id.indexOf(options.term) != -1) || (vm.text.indexOf(options.term) != -1);
                    });
                    var tags = $.grep($scope.tags, function(tag){
                        return (tag.id.indexOf(options.term) != -1) || (tag.text.indexOf(options.term) != -1);
                    });

                    results = [{
                        text: "Vms",
                        children: vms
                    },{
                        text: "Tags",
                        children: tags
                    }]
                }

                options.callback({
                    more: false,
                    results: results
                })
            }

            function extractVmInfo(machines) {
                for(var m in machines) {
                    var machine = machines[m];
                    if(ng.isObject(machine)) {

                        if(Object.keys(machine.tags).length) {
                            for(var tag in machine.tags) {
                                if($scope.tags.indexOf(tag) === -1) {
                                    $scope.tags.push({
                                        id:JSON.stringify({
                                            type: 'tag',
                                            text: tag,
                                            value: null
                                        }),
                                        text:tag
                                    });
                                }
                            }
                        }
                        $scope.vms.push({
                            id:JSON.stringify({
                                type: 'vm',
                                text: machine.id,
                                value: null
                            }),
                            text:machine.name ? machine.name + ' (' + machine.id + ')' : machine.id
                        });
                    }
                }

            }

            // Create target comboboxes
            var from = $('#fromSelect').select2({
                width: 220,
                query: query,
                initSelection : function () {}
            }).change(function(e){
                $scope.$apply(function(){
                    var val = $.parseJSON(e.val);
                    $scope.current.from = val;
                });
            });

            var to = $('#toSelect').select2({
                width: 220,
                query: query,
                initSelection : function () {}
            }).change(function(e){
                $scope.$apply(function(){
                    var val = $.parseJSON(e.val);
                    $scope.current.to = val;
                });
            });

            $scope.CIDRs = [];
            for(var i=0; i<=32; i++) {
                $scope.CIDRs.push(i);
            }
            $scope.fromSubnet = {
                address:null,
                CIDR:32
            };
            $scope.toSubnet = {
                address:null,
                CIDR:32
            };

            $scope.$watch('fromSubnet', function(n) {
                if(n.CIDR && n.address) {
                    $scope.current.from.text = n.address + '/' + n.CIDR;
                }
            }, true);

            $scope.$watch('toSubnet', function(n) {
                if(n.CIDR && n.address) {
                    $scope.current.to.text = n.address + '/' + n.CIDR;
                }
            }, true);

            $scope.$watch('current.from.type', function() {
                $scope.fromSubnet = {
                    address:null,
                    CIDR:32
                };
            });

            $scope.$watch('current.to.type', function() {
                $scope.toSubnet = {
                    address:null,
                    CIDR:32
                };
            });



            $scope.loading = true;
            $scope.tags = [];
            $scope.vms = [];
            $scope.current = {
                from: null,
                to: null,
                port: null,
                type: 0,
                code: null
            };
            $scope.data = {};
            $scope.dropdown = [{
                text:'',
                children:[{
                    id: JSON.stringify({
                        type: 'wildcard',
                        text: 'all vms'
                    }),
                    text: 'Any Vm'
                },{
                    id: JSON.stringify({type: 'ip'}),
                    text: 'IP'
                }, {
                    id: JSON.stringify({type: 'subnet'}),
                    text:'Subnet'
                }, {
                    id: JSON.stringify({type: 'tag'}),
                    text:'Tag'
                }, {
                    id: JSON.stringify({type: 'vm'}),
                    text:'Vm'
                }]
            },{
                text: "Vms",
                children: $scope.vms
            },{
                text: "Tags",
                children: $scope.tags
            }];

            $scope.datacenter = 'us-beta-4';

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

            function setRules(rules) {
                $scope.rules = rules[$scope.datacenter];
            }

            // get lists from services
            $scope.machines = Machine.machine();
            $scope.rulesByDatacenter = rule.rule();
            $q.all([
                $q.when($scope.machines),
                $q.when($scope.rulesByDatacenter)
            ]).then(function(lists){
                $scope.$watch('datacenter', function(dc){
                    if(dc) {

                        setRules(lists[1]);

                        if(lists[0].length) {
                            extractVmInfo(lists[0]);
                        }
                        $scope.resetCurrent();
                        $scope.resetData();
                        $scope.loading = false;
                    }
                });
            });

            // rule create/edit form controls

            $scope.resetData = function () {
                $scope.data.uuid = null;
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

            $scope.resetCurrent = function() {
                if(from && $scope.current.from) {
                    from.select2("val", '');
                }
                if(to && $scope.current.to) {
                    to.select2("val", '');
                }
                $scope.current.from = {
                    type: 'wildcard',
                    text: 'any',
                    value: null
                };
                $scope.current.to = {
                    type: 'wildcard',
                    text: 'any',
                    value: null
                };

            }

            $scope.addPort =function() {
                $scope.data.parsed.protocol.targets.push($scope.current.port);
                $scope.current.port = null;
            }

            $scope.addType = function() {
                var target = $scope.current.type;
                if($scope.current.code || $scope.current.code === 0) {
                    target+= ':' + $scope.current.code;
                }
                $scope.data.parsed.protocol.targets.push(target);
                $scope.current.type = 0;
                $scope.current.code = null;
            }

            function addTarget(direction) {
                var target = [];
                var data = $scope.current[direction];
                if(data.type == 'wildcard', data.text == 'any') {
                    clearTarget(direction);
                    data = {
                        type: 'wildcard',
                        text: 'any'
                    };
                }

                if($scope.data.parsed[direction].length == 1 && $scope.data.parsed[direction][0][0] == 'wildcard') {
                    $scope.data.parsed[direction] = [];
                }

                target[0] = data.type;

                if(data.value) {
                    target[1] = [data.text, data.value];
                } else {
                    target[1] = data.text;
                }

                $scope.data.parsed[direction].push(target);

                $scope.resetCurrent();
            }

            function clearTarget(direction) {
                $scope.data.parsed[direction] = [];
            }

            $scope.addFrom = function() {
                addTarget('from');
            }

            $scope.addTo = function() {
                addTarget('to');
            }

            $scope.removeFrom = function(i) {
                $scope.data.parsed.from.splice(i, 1);
                if(!$scope.data.parsed.from.length) {
                    $scope.data.parsed.from = [['wildcard', 'any']];
                }
            }
            $scope.removeTo = function(i) {
                $scope.data.parsed.to.splice(i, 1);
                if(!$scope.data.parsed.to.length) {
                    $scope.data.parsed.to = [['wildcard', 'any']];
                }
            }

            $scope.isAny = function(target) {
                // handle array
                if(ng.isArray(target) && target.length == 2) {
                    return target[0] == 'wildcard' && target[1] == 'any';

                // handle object
                } else if (ng.isObject(target)){
                    return target.type == 'wildcard' && target.text == 'any';
                }
                return false;
            }

            $scope.editRule = function(r) {
                var n = ng.copy(r);
                $scope.data.uuid = n.uuid;
                $scope.data.datacenter = n.datacenter;
                $scope.data.parsed = {
                    from: n.parsed.from,
                    to: n.parsed.to,
                    action: n.parsed.action,
                    protocol: n.parsed.protocol
                };
                $scope.data.enabled = n.enabled;
            }

            // Rule controls to interact with service

            // Temporary solution for updating rule information
            // deletes old rule and creates new modified rule
            $scope.updateRule = function() {

                var data = ng.copy($scope.data);
                rule.deleteRule(({uuid: data.uuid, datacenter: data.datacenter}));

                rule.createRule(data).then(function(){
                    console.log('update rule', arguments)
                })

            }
            $scope.deleteRule = function(r) {
                rule.deleteRule({
                    uuid: r.uuid,
                    datacenter: r.datacenter
                }).then(function(){
                    console.log('delete rule', arguments)

                })
            }

            $scope.createRule = function() {
                var data = ng.copy($scope.data);
                rule.createRule(data).then(function(r){
                    if(r.id) {
                        rule.rule().then(function(r){
                            setRules(r);
                            $scope.resetData();
                        });
                    }
                })
            }

        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
