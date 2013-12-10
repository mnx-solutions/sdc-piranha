'use strict';

(function (ng, app) {
    app.controller('Firewall.IndexController', [
        '$scope',
        'Datacenter',
        '$cookieStore',
        '$filter',
        'requestContext',
        'localization',
        'rule',
        '$q',
        'Machine',
        'util',

        function ($scope, Datacenter, $cookieStore, $filter, requestContext, localization, rule, $q, Machine, util) {

            localization.bind('firewall', $scope);
            requestContext.setUpRenderContext('firewall.index', $scope);

            $scope.openRuleForm = false;

            $scope.toggleOpenRuleForm = function () {
                $scope.openRuleForm = !$scope.openRuleForm;
            };

            var MAX_IN_DROPDOWN = 3; // maximum Vms and Tags in default dropdown

            function query(options){
                var results = [];


                if(options.term === '') {
                    results = ng.copy($scope.dropdown);

                    if(results[1].children.length > MAX_IN_DROPDOWN) {
                        results[1].children.splice(MAX_IN_DROPDOWN);
                    }
                    if(results[2].children.length > MAX_IN_DROPDOWN) {
                        results[2].children.splice(MAX_IN_DROPDOWN);
                    }
                } else {
                    var vms = $scope.vms.filter(function(vm){
                        return (vm.id.indexOf(options.term) !== -1) || (vm.text.indexOf(options.term) !== -1);
                    });
                    var tags = $scope.tags.filter(function(tag){
                        return (tag.id.indexOf(options.term) !== -1) || (tag.text.indexOf(options.term) !== -1);
                    });

                    results = [{
                        text: "Vms",
                        children: vms
                    },{
                        text: "Tags",
                        children: tags
                    }];
                }

                options.callback({
                    more: false,
                    results: results
                });
            }

            function extractVmInfo(machines) {
                for(var m in machines) {
                    var machine = machines[m];
                    if(ng.isObject(machine) && machine.compute_node) {

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

                $scope.loading = false;

            }

            // Create target comboboxes
            var from = $('#fromSelect').select2({
                width: 220,
                query: query,
                initSelection : function () {}
            }).change(function(e){
                $scope.$apply(function(){
                    $scope.current.from = ng.fromJson(e.val);
                });
            });

            var to = $('#toSelect').select2({
                width: 220,
                query: query,
                initSelection : function () {}
            }).change(function(e){
                $scope.$apply(function(){
                    $scope.current.to = ng.fromJson(e.val);
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

            $scope.$watch('data', function(n, o) {
                if (n) {
                    var data = $scope.getData();
                    if (n.parsed && o.parsed && n.parsed.protocol.name !== o.parsed.protocol.name && n.uuid == o.uuid) {
                        $scope.clearProtocolTargets();
                    }
                    if (!data.parsed) {
                        $scope.validData = false;
                        return;
                    }
                    if (!data.parsed.from || data.parsed.from.length === 0 || ($scope.isAny(data.parsed.from[0]) && $scope.isAny(data.parsed.to[0]))) {
                        $scope.validData = false;
                        return;
                    }
                    if (!data.parsed.to || data.parsed.to.length === 0  || ($scope.isAny(data.parsed.from[0]) && $scope.isAny(data.parsed.to[0]))) {
                        $scope.validData = false;
                        return;
                    }
                    if (!data.parsed.protocol.name) {
                        $scope.validData = false;
                        return;
                    }
                    if (!data.parsed.protocol.targets || data.parsed.protocol.targets.length === 0) {
                        $scope.validData = false;
                        return;
                    }
                    $scope.validData = true;
                }
            }, true);

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

            $scope.$watch('current.code', function(n) {
                if(!n || n == '') {
                    $scope.protocolForm.code.$setValidity('range', true);
                }
            });

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
                    id: ng.toJson({
                        type: 'wildcard',
                        text: 'all vms'
                    }),
                    text: 'Any Vm'
                },{
                    id: ng.toJson({type: 'ip'}),
                    text: 'IP'
                }, {
                    id: ng.toJson({type: 'subnet'}),
                    text:'Subnet'
                }, {
                    id: ng.toJson({type: 'tag'}),
                    text:'Tag'
                }, {
                    id: ng.toJson({type: 'vm'}),
                    text:'Vm'
                }]
            },{
                text: "Vms",
                children: $scope.vms
            },{
                text: "Tags",
                children: $scope.tags
            }];
            $scope.datacenters = Datacenter.datacenter();
            $scope.datacenter = null;

	        $scope.selectDatacenter = function (name) {
		        $scope.datacenter = name;
	        };

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

            $scope.setRules = function (rules) {
                var dcRules = [];
                Object.keys(rules).forEach(function (datacenter) {
                    rules[datacenter].forEach(function (rule) {
                        rule.datacenter = datacenter;
                        dcRules.push(rule);
                    });
                });
	            $scope.rules = dcRules;
            };

            // get lists from services
            $scope.loading = true;
            $scope.rules = [];
            $scope.machines = Machine.machine();
            $scope.machinesLoading = true;
            $scope.notAffectedMachines = [];
            $scope.rulesByDatacenter = rule.rule();

            $q.all([
                $q.when($scope.machines),
                $q.when($scope.rulesByDatacenter),
                $q.when($scope.datacenters)
            ]).then(function(lists){
                $scope.setRules(lists[1]);

                $scope.$watch('machines.final', function(isFinal) {
                    if (isFinal) {
                        extractVmInfo($scope.machines);

                        Object.keys($scope.machines).forEach(function(index) {
                            var m = $scope.machines[index];

                            if(m.id && !m.firewall_enabled) {
                                $scope.notAffectedMachines.push(m);
                            }
                        });
                        $scope.machinesLoading = false;
                    }
                });

                $scope.datacenter = lists[2][0].name;
                $scope.$watch('datacenter', function(dc){
                    if(dc) {
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

            $scope.getData = function() {
	            var data = rule.cleanRule($scope.data);
	            if(!data.datacenter) {
		            data.datacenter = $scope.datacenter;
	            }
	            return data;
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

            };

            $scope.useAllPorts = function() {
                $scope.data.parsed.protocol.targets = ['all'];
            };

            $scope.isAllPorts = function () {
                var ports = $scope.data.parsed.protocol.targets;
                if (ports.length && ports[0] == 'all') {
                    return true;
                }
                return false;
            };

            $scope.addPort = function() {
                $scope.data.parsed.protocol.targets.push($scope.current.port);
                $scope.current.port = '';
                $scope.current.allPorts = false;
                $scope.protocolForm.port.$setValidity('range', false);
            };

            $scope.addType = function() {
                var target = $scope.current.type;
                if($scope.current.code || $scope.current.code === 0) {
                    target+= ':' + $scope.current.code;
                }
                $scope.data.parsed.protocol.targets.push(target);
                $scope.current.type = 0;
                $scope.current.code = null;
                $scope.protocolForm.code.$setValidity('range', false);
            };

            function addTarget(direction) {
                var target = [];
                var data = $scope.current[direction];
                if(data.type === 'wildcard', data.text === 'any') {
                    clearTarget(direction);
                    data = {
                        type: 'wildcard',
                        text: 'any'
                    };
                }

                if($scope.data.parsed[direction].length === 1 && $scope.data.parsed[direction][0][0] === 'wildcard') {
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

            $scope.clearProtocolTargets = function() {
                $scope.data.parsed.protocol.targets = [];
            };

            $scope.addFrom = addTarget.bind(addTarget, 'from');
            $scope.addTo = addTarget.bind(addTarget, 'to');

            $scope.removeFrom = function(i) {
                $scope.data.parsed.from.splice(i, 1);
                if(!$scope.data.parsed.from.length) {
                    $scope.data.parsed.from = [['wildcard', 'any']];
                }
            };

            $scope.removeProtocolTarget = function(i) {
                $scope.data.parsed.protocol.targets.splice(i, 1);
            };

            $scope.removeTo = function(i) {
                $scope.data.parsed.to.splice(i, 1);
                if(!$scope.data.parsed.to.length) {
                    $scope.data.parsed.to = [['wildcard', 'any']];
                }
            };

            $scope.isAny = function(target) {
                // handle array
                if(ng.isArray(target) && target.length === 2) {
                    return target[0] === 'wildcard' && target[1] === 'any';

                // handle object
                }
	            if (ng.isObject(target)){
                    return target.type === 'wildcard' && target.text === 'any';
                }
                return false;
            };

            // Rule controls to interact with service

            // Temporary solution for updating rule information
            // deletes old rule and creates new modified rule
            $scope.updateRule = function() {
                $scope.loading = true;
                rule.deleteRule($scope.data).then(function(){
                    rule.createRule($scope.data).then(function(){
                        $scope.refresh();
                    })
                });

            };

            $scope.createRule = function() {
                $scope.loading = true;
                rule.createRule($scope.getData()).then(function(r){
                    if(r.id) {
                        $scope.refresh();
                    }
                });
            };

            $scope.saveRule = function () {
                return ($scope.data.uuid ? $scope.updateRule : $scope.createRule)();
            };
            $scope.deleteRule = function(r) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete firewall rule'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Delete current firewall rule'
                    ), function () {

                        // Redirect if complete
                        $scope.loading = true;
                        rule.deleteRule(r).then(function(){
                            $scope.refresh();
                        });
                    });
            };

            $scope.changeStatus = function(r) {
                $scope.loading = true;
	            var fn = r.enabled ? 'disableRule' : 'enableRule';
	            rule[fn](r).then(function() {
		            $scope.refresh();
	            });
            };
            $scope.refresh = function() {
                $scope.loading = true;
                rule.rule().then(function(r){
                    $scope.resetData();
                    $scope.resetCurrent();
                    $scope.setRules(r);
                    $scope.loading = false;
                });
            };

	        $scope.gridOrder = [];
	        $scope.gridProps = [
		        {
			        id: 'parsed',
			        id2: 'from',
			        name: 'From',
			        getClass: function () {
				        return 'span2 padding-5';
			        },
			        _getter: function (object) {
				        var arr = object.parsed.from.map(function (from) {
					        return $filter('targetInfo')(from);
				        });
				        return arr.join('; ');
			        },
			        sequence: 1
		        },
		        {
			        id: 'parsed',
			        id2: 'to',
			        name: 'To',
			        getClass: function () {
				        return 'span2 padding-5';
			        },
			        _getter: function (object) {
				        var arr = object.parsed.to.map(function (to) {
					        return $filter('targetInfo')(to);
				        });
				        return arr.join('; ');
			        },
			        sequence: 2
		        },
		        {
			        id: 'parsed',
			        id2: 'action',
			        name: 'Action',
			        getClass: function () {
				        return 'span1 padding-5';
			        },
			        sequence: 3
		        },
		        {
			        id: 'protocol',
			        name: 'Protocol',
			        getClass: function () {
				        return 'span2 padding-5';
			        },
			        _getter: function (object) {
				        return object.parsed.protocol.name + ' ' + object.parsed.protocol.targets.join('; ');
			        },
			        sequence: 4
		        },
                {
                    id: 'datacenter',
                    name: 'Datacenter',
                    getClass: function () {
                        return 'span2 padding-5';
                    },
                    sequence: 5
                },
		        {
			        id: 'delete',
			        name: 'Delete',
			        type: 'button',
			        getClass: function () {
				        return 'pull-right span1 padding-5';
			        },
			        btn: {
				        label: 'Delete',
				        getClass: function (object) {
					        return 'btn-mini btn-danger';
				        },
				        disabled: function () {
					        return $scope.loading;
				        },
				        action: $scope.deleteRule.bind($scope),
				        tooltip: 'Delete the rule'
			        }
		        },
		        {
			        id: 'edit',
			        name: 'Edit',
			        type: 'button',
			        getClass: function () {
				        return 'pull-right span1 padding-5';
			        },
			        btn: {
				        label: 'Edit',
				        getClass: function () {
					        return 'btn-mini btn-default';
				        },
				        disabled: function () {
					        return $scope.loading;
				        },
				        action: function (object) {
					        $scope.data = rule.cleanRule(object);
                            $scope.openRuleForm = true;
				        },
				        tooltip: 'Edit the rule'
			        }
		        },
		        {
			        id: 'enabled',
			        name: 'Enabled',
			        type: 'button',
			        getClass: function () {
				        return 'pull-right span1 padding-5';
			        },
			        btn: {
				        getLabel: function (object) {
					        return object.enabled ? 'Enabled' : 'Disabled';
				        },
				        getClass: function (object) {
					        return 'btn-mini btn-minier ' + (object.enabled ? 'btn-success' : 'btn-danger');
				        },
                        disabled: function () {
                            return $scope.loading;
                        },
				        action: $scope.changeStatus.bind($scope),
				        tooltip: 'Change rule status'
			        }
		        }
	        ];

        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
