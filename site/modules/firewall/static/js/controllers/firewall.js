'use strict';

(function (ng, app) {

    function equalArrays(array1, array2) {
        if (!array2)
            return false;

        if (array1.length != array2.length)
            return false;

        for (var i = 0, l=array1.length; i < l; i++) {
            if (array1[i] instanceof Array && array2[i] instanceof Array) {
                if (!equalArrays(array1[i], array2[i]))
                    return false;
            }
            else if (array1[i] != array2[i]) {
                return false;
            }
        }
        return true;
    }

    app.controller('Firewall.IndexController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$q',
        'requestContext',
        'localization',
        'rule',
        'Datacenter',
        'Machine',
        'util',
        '$dialog',
        '$http',

        function ($scope, $cookieStore, $filter, $q, requestContext, localization, rule, Datacenter, Machine, util, $dialog, $http) {

            localization.bind('firewall', $scope);
            requestContext.setUpRenderContext('firewall.index', $scope);

            $scope.openRuleForm = false;

            $scope.toggleOpenRuleForm = function () {
                $scope.openRuleForm = !$scope.openRuleForm;
            };

            $scope.disableLoading = function() {
                $scope.loading = false;
            };

            function query(options, type){
                if(!type) {
                    type = false;
                }
                var results = [];

                if(options.term === '' && !type) {
                    results = ng.copy($scope.dropdown);
                    if (options.reverse) {
                        results[0].children.reverse();
                    }
                } else {
                    var vms = $scope.vms.filter(function(vm){
                        return ((vm.id.indexOf(options.term) !== -1) || (vm.text.indexOf(options.term) !== -1)) && vm.datacenter === $scope.datacenter;
                    });
                    var tags = $scope.tags.filter(function(tag){
                        return ((tag.id.indexOf(options.term) !== -1) || (tag.text.indexOf(options.term) !== -1)) && tag.datacenter === $scope.datacenter;
                    });

                    results = [{
                        text: "Instances",
                        children: vms
                    },{
                        text: "Tags",
                        children: tags
                    }];

                    if(type == 'Instances') {
                        results = [results[0]];
                    }

                    if(type == 'Tags') {
                        results = [results[1]];
                    }
                }

                options.callback({
                    more: false,
                    results: results
                });
            }


            function instancesQuery(o) {
                return query(o, 'Instances');
            }

            function tagsQuery(o) {
                return query(o, 'Tags');
            }

            function reverseQuery(o) {
                o.reverse = true;
                return query(o);
            }

            function extractVmInfo(machines) {
                for(var m in machines) {
                    var machine = machines[m];
                    // FIXME:
                    //if(ng.isObject(machine) && machine.compute_node) {
                    if(ng.isObject(machine) && machine.type !== 'virtualmachine') {

                        if(Object.keys(machine.tags).length) {
                            for(var tag in machine.tags) {
                                if($scope.tags.indexOf(tag) === -1) {
                                    $scope.tags.push({
                                        id:JSON.stringify({
                                            type: 'tag',
                                            text: tag,
                                            value: null
                                        }),
                                        datacenter: machine.datacenter,
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
                            datacenter: machine.datacenter,
                            text:machine.name ? machine.name + ' (' + machine.id + ')' : machine.id
                        });
                    }
                }

                $scope.loading = false;

            }

            function createCombobox(id, objId, propId, query, addOnSelect) {
                return $(id).select2({
                    width: '100%',
                    query: query,
                    initSelection : function () {}
                }).change(function(e){
                    var val = ng.fromJson(e.val);

                    if (val.type === 'vm' && val.text && (e.currentTarget.id === 'fromSelect' || e.currentTarget.id === 'toSelect')) {
                        $(id).select2('data', {
                            id: ng.toJson({type: 'vm'}),
                            text: 'Instance'
                        });
                    } else {
                    $scope.$apply(function(){
                            if (e.currentTarget.id === 'fromSelect') {
                                $scope.fromForm.$pristine = true;
                            } else if (e.currentTarget.id === 'toSelect') {
                                $scope.toForm.$pristine = true;
                            }
                        });
                    }

                    $scope.$apply(function(){
                        $scope[objId][propId] = val;
                        if(addOnSelect) {
                            addOnSelect(val);
                        }
                    });
                });
            }

            // Create target comboboxes
            var from = createCombobox('#fromSelect', 'current', 'from', query, false);
            var to = createCombobox('#toSelect', 'current', 'to', reverseQuery, false);

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
                        $scope.invalidReason = 'No rule specified';
                        $scope.validData = false;
                        return;
                    }
                    if (!data.parsed.protocol || !data.parsed.protocol.name
                        || !data.parsed.protocol.targets || data.parsed.protocol.targets.length === 0) {
                        $scope.invalidReason = 'A Protocol condition is needed in the firewall rule';
                        $scope.validData = false;
                        return;
                    }
                    if (!data.parsed.from || data.parsed.from.length === 0) {
                        $scope.invalidReason = 'A From condition is needed in the firewall rule';
                        $scope.validData = false;
                        return;
                    }
                    if (!data.parsed.to || data.parsed.to.length === 0) {
                        $scope.invalidReason = 'A To condition is needed in the firewall rule';
                        $scope.validData = false;
                        return;
                    }
                    $scope.invalidReason = null;
                    $scope.validData = true;
                }
            }, true);

            $scope.$watch('fromSubnet', function(n) {
                if (n.CIDR && n.address) {
                    $scope.current.from.text = n.address + '/' + n.CIDR;
                }
            }, true);

            $scope.$watch('toSubnet', function(n) {
                if (n.CIDR && n.address) {
                    $scope.current.to.text = n.address + '/' + n.CIDR;
                }
            }, true);

            $scope.$watch('current.code', function(n) {
                if (!n || n == '') {
                    $scope.protocolForm.code.$setValidity('range', true);
                }
            });

            function selectVm(select, objId) {
                $scope.vms.forEach(function (vm) {
                    var id = ng.fromJson(vm.id);
                    if (id.text === $scope.current[objId].text) {
                        select.select2('data', vm);
                        $scope.$apply(function () {
                            $scope[objId + 'Form'].$pristine = false;
                        });
                                    }
                })
                                }

            function formWatch(obj, oldObj, formName, formId) {
                if (obj && (!oldObj || oldObj.type !== 'vm' || obj.text) && obj.type === 'vm') {
                    setTimeout(function(){
                        var fromInstanceSelect = $('#' + formId);
                        createCombobox('#' + formId, 'current', formName, instancesQuery, function(m) {
                            fromInstanceSelect.select2('val', m.text);
                            $scope[formName + 'Form'].$pristine = false;
                        });

                        selectVm(fromInstanceSelect, formName);
                    }, 1);
                                    }
                                }

            $scope.$watch('current.from', function (obj, oldObj) {
                formWatch(obj, oldObj, 'from', 'fromInstanceSelect');
            }, true);

            $scope.$watch('current.to', function (obj, oldObj) {
                formWatch(obj, oldObj, 'to', 'toInstanceSelect');
            }, true);

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
                        text: 'any'
                    }),
                    text: 'Any'
                },{
                    id: ng.toJson({type: 'subnet'}),
                    text: 'Subnet'
                }, {
                    id: ng.toJson({type: 'ip'}),
                    text: 'IP'
                }, {
                    id: ng.toJson({
                        type: 'wildcard',
                        text: 'all vms'
                    }),
                    text: 'All my VMs in DC'
                }, {
                    id: ng.toJson({type: 'tag'}),
                    text:'Tag'
                }, {
                    id: ng.toJson({type: 'vm'}),
                    text:'Instance'
                }]
            }];
            $scope.datacenters = Datacenter.datacenter();
            $scope.datacenter = null;

	        $scope.selectDatacenter = function (name) {
		        $scope.datacenter = name;
	        };

            $scope.actions = [{
                id:'allow',
                text:'Allow'
            },{
                id:'block',
                text:'Block'
            }];

            $scope.states = [{
                id: 'true',
                text:'Enabled'
            },{
                id: 'false',
                text:'Disabled'
            }];

            $scope.protocols = [{
                id:'tcp',
                text:'TCP'
            },{
                id:'udp',
                text:'UDP'
            },{
                id:'icmp',
                text:'ICMP'
            }];

            $scope.selected = {
                action: $scope.actions[0].text,
                status: $scope.states[1].text,
                protocol: $scope.protocols[0].text
            };

            $scope.refreshSelects = function () {
                // update select2's
                $('#actionSelect').select2('val', $scope.data.parsed.action);
                $('#stateSelect').select2('val', $scope.data.enabled.toString());
                $('#protocolSelect').select2('val', $scope.data.parsed.protocol.name);
                $('#dcSelect').select2('enable').select2('val', $scope.data.datacenter);
            };

            $('#actionSelect').select2({
                data: $scope.actions,
                minimumResultsForSearch: -1,
                width: "100%"
            }).change(function (e) {
                $scope.$apply(function(){
                    $scope.data.parsed.action = e.val;
                    $scope.actions.some(function (action) {
                        if(action.id === e.val) {
                            $scope.selected.action = action.text;
                            return true;
                        }
                    });
                });
            }).select2('val', $scope.actions[0].id);

            $('#protocolSelect').select2({
                data: $scope.protocols,
                minimumResultsForSearch: -1,
                width: "100%"
            }).change(function (e) {
                $scope.$apply(function(){
                    $scope.data.parsed.protocol.name = e.val;
                    $scope.protocols.some(function (action) {
                        if(action.id === e.val) {
                            $scope.selected.protocol = action.text;
                            return true;
                        }
                    });
                });
            }).select2('val', $scope.protocols[0].id);

            $('#stateSelect').select2({
                data: $scope.states,
                minimumResultsForSearch: -1,
                width: "100%"
            }).change(function (e) {
                $scope.$apply(function(){
                    $scope.data.enabled = e.val === 'true' ? true : false;
                    $scope.states.some(function (action) {
                        if(action.id === e.val) {
                            $scope.selected.status = action.text;
                            return true;
                        }
                    });
                });
            }).select2('val', $scope.states[1].id);

            $scope.$watch('datacenters', function (newVal) {
                if(newVal && ng.isArray(newVal) && newVal.length > 0) {
                    $scope.selected.datacenter = $scope.selected.datacenter || newVal[0].name;
                    $('#dcSelect').select2('destroy');
                    $('#dcSelect').select2({
                        data: newVal.map(function (dc) { return {id: dc.name, text: dc.name}; }),
                        minimumResultsForSearch: -1,
                        width: "100%"
                    }).change(function (e) {
                        $scope.$apply(function () {
                            $scope.datacenter = e.val;
                            $scope.selected.datacenter = e.val;
                        });
                    }).select2('val', $scope.selected.datacenter);

                }
            });

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
            $scope.kvmList = [];
            $scope.firewallDisabledMachines = [];
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

                            if(m.id && m.type == 'virtualmachine') {
                                $scope.kvmList.push(m);
                                return;
                            }

                            if(m.id && !m.hasOwnProperty('firewall_enabled')) {
                                $scope.notAffectedMachines.push(m);
                                return;
                            }

                            if(m.id && m.firewall_enabled === false) {
                                $scope.firewallDisabledMachines.push(m);
                            }
                        });

                        $scope.machinesLoading = false;
                    }
                });

                $scope.datacenter = lists[2][0].name;
                $scope.$watch('datacenter', function(dc){
                    if(dc) {
                        $scope.resetCurrent('from');
                        $scope.resetCurrent('to');
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
                $scope.data.parsed.from = [];
                $scope.data.parsed.to = [];
                $scope.data.parsed.action = 'allow';
                $scope.data.parsed.protocol = {
                    name:'tcp',
                    targets:[]
                };
                $scope.data.enabled = false;

                $scope.refreshSelects();
            };

            $scope.getData = function() {
	            var data = rule.cleanRule($scope.data);
	            if(!data.datacenter) {
		            data.datacenter = $scope.datacenter;
	            }
	            return data;
            };

            $scope.resetCurrent = function (direction) {
                if (from && direction === 'from') {
                    from.select2('val', '');
                }

                if (to && direction === 'to') {
                    to.select2('val', '');
                }

                if (!direction || direction === 'from') {
                    $scope.current.from = {
                        type: 'wildcard',
                        value: null
                    };

                    $scope.fromSubnet = {
                        address: null,
                        CIDR: 32
                    };

                    // No $setPristine
                    $scope.fromForm.$pristine = true;
                    $scope.fromForm.$dirty = false;
                }

                if (!direction || direction === 'to') {
                    $scope.current.to = {
                        type: 'wildcard',
                        value: null
                    };

                    $scope.toSubnet = {
                        address: null,
                        CIDR: 32
                    };

                    // No $setPristine
                    //$scope.toForm.$pristine = true;
                    //$scope.toForm.$dirty = false;
                }
            };

            $scope.useAllPorts = function() {
                $scope.data.parsed.protocol.targets = ['all'];
            };

            $scope.isAllPorts = function () {
                var ports = $scope.data.parsed.protocol.targets;
                if (ports && ports.length && ports[0] == 'all') {
                    return true;
                }
                return false;
            };

            $scope.addPort = function() {
                var targets = $scope.data.parsed.protocol.targets;

                if($scope.isAllPorts()) {
                    targets.length = 0;
                }

                if(targets.indexOf($scope.current.port) === -1
                    && targets.indexOf(parseInt($scope.current.port)) === -1) {
                    targets.push($scope.current.port);
                }
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

            function showErrorMessage(message) {
                    var title = 'Error';
                    var btns = [
                        {
                            result: 'ok',
                            label: 'OK',
                            cssClass: 'orange'
                        }
                    ];

                    return $dialog.messageBox(title, message, btns)
                        .open()
                        .then(function (result) {
                        });
            }

            function addTarget (direction, other) {
                var target = [];
                var data = $scope.current[direction];
                var otherDir = $scope.data.parsed[other];

                if (otherDir[0] && ($scope.isAny(otherDir[0]) && $scope.isAny(data))) {
                    showErrorMessage('FROM and TO both cannot be set to ANY. Please choose one.');

                    clearTarget(direction);
                    return;
                }

                if (data.type === 'wildcard') {
                    clearTarget(direction);
                }

                if ($scope.data.parsed[direction].length === 1 &&
                    $scope.data.parsed[direction][0][0] === 'wildcard') {
                    $scope.data.parsed[direction] = [];
                }

                target[0] = data.type;

                if (data.value) {
                    target[1] = [data.text, data.value];
                } else {
                    target[1] = data.text;
                }

                // if target already present, don't add
                for (var tar in $scope.data.parsed[direction]) {
                    if (equalArrays($scope.data.parsed[direction][tar], target)) {
                        $scope.resetCurrent(direction);
                        return false;
                    }
                }

                $scope.data.parsed[direction].push(target);
                $scope.resetCurrent(direction);
            }

            function clearTarget(direction) {
                $scope.data.parsed[direction] = [];
            }

            $scope.clearProtocolTargets = function() {
                $scope.data.parsed.protocol.targets = [];
            };

            $scope.addFrom = addTarget.bind(addTarget, 'from', 'to');
            $scope.addTo = addTarget.bind(addTarget, 'to', 'from');

            $scope.removeFrom = function(i) {
                $scope.data.parsed.from.splice(i, 1);
                if(!$scope.data.parsed.from.length && !$scope.isAny($scope.data.parsed.to[0])) {
                    $scope.data.parsed.from = [];
                }
            };

            $scope.removeProtocolTarget = function(i) {
                $scope.data.parsed.protocol.targets.splice(i, 1);
            };

            $scope.removeTo = function(i) {
                $scope.data.parsed.to.splice(i, 1);
                if(!$scope.data.parsed.to.length && !$scope.isAny($scope.data.parsed.from[0])) {
                    $scope.data.parsed.to = [];
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
                rule.updateRule($scope.data).then(function () {
                    rule.clearRules();
                    $scope.refresh();
                }, $scope.disableLoading);
            };

            $scope.openPopovers = [];
            $('body').on('click', function(e) {
                if(!ng.element(e.target).hasClass('popover') && !ng.element(e.target).parent().hasClass('popover')) {
                    // close all the popovers
                    $scope.openPopovers.forEach(function(el) {
                        ng.element(el).popover('destroy');
                    });
                }
            });

            $scope.stringifyRule = function (el, rule) {
                if(typeof $scope[rule] === 'function') {
                    rule = $scope[rule]();
                }

                $http.post('./firewall/stringify', rule).then(function(response) {
                    var stringifiedRule = response.data.rule;
                    ng.element(el).popover('destroy');
                    ng.element(el).popover(
                        {
                            container: 'body',
                            content: stringifiedRule,
                            placement: 'top',
                            title: 'FWRULE string for CLI'
                        }
                    );
                    ng.element(el).popover('show');
                    $scope.openPopovers.push(el);
                });
            };

            $scope.createRule = function() {
                $scope.loading = true;

                rule.createRule($scope.getData()).then(function(r){
                    if(r.id) {
                        $scope.refresh();
                    }
                }, $scope.disableLoading);
            };

            $scope.saveRule = function () {
                if (!$scope.validData) {
                    showErrorMessage($scope.invalidReason);
                    return;
                }
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
                        }, $scope.disableLoading);
                        $scope.openRuleForm = false;
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
                    $scope.openRuleForm = false;
                }, $scope.disableLoading);
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
			        sequence: 5,
                    active: true
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
			        sequence: 6,
                    active: true
		        },
		        {
			        id: 'parsed',
			        id2: 'action',
			        name: 'Action',
			        getClass: function () {
				        return 'span1 padding-5';
			        },
			        sequence: 3,
                    active: true
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
			        sequence: 4,
                    active: true
		        },
                {
                    id: 'datacenter',
                    name: 'Data Center',
                    getClass: function () {
                        return 'span2 padding-5';
                    },
                    sequence: 2,
                    active: true
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
					        return 'btn-danger';
				        },
				        disabled: function () {
					        return $scope.loading;
				        },
				        action: $scope.deleteRule.bind($scope),
				        tooltip: 'Delete the rule'
			        },
                    active: true
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
					        return 'btn-default';
				        },
				        disabled: function () {
					        return $scope.loading;
				        },
				        action: function (object) {
					        $scope.data = rule.cleanRule(object);

                            $scope.refreshSelects();
                            $('#dcSelect').select2('disable');
                            $scope.openRuleForm = true;
				        },
				        tooltip: 'Edit the rule'
			        },
                    active: true
		        },
                {
                    id: 'enabled',
                    name: 'Status',
                    type: 'button',
                    getClass: function () {
                        return 'span1 padding-5';
                    },
                    btn: {
                        getLabel: function (object) {
                            return object.enabled ? 'Enabled' : 'Disabled';
                        },
                        getClass: function (object) {
                            return (object.enabled ? 'btn-success' : 'btn-danger');
                        },
                        disabled: function () {
                            return $scope.loading;
                        },
                        action: $scope.changeStatus.bind($scope),
                        tooltip: 'Change rule status'
                    },
                    sequence: 1,
                    active: true
                }
	        ];

        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
