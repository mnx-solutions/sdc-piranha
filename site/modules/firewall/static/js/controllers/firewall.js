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
        '$rootScope',
        '$filter',
        '$q',
        '$qe',
        'requestContext',
        'localization',
        'rule',
        'Image',
        'Datacenter',
        'Machine',
        '$http',
        'PopupDialog',
        'Account',
        '$location',
        '$anchorScroll',

        function ($scope, $rootScope, $filter, $q, $qe, requestContext, localization, rule, Image, Datacenter, Machine, $http, PopupDialog, Account, $location,
                  $anchorScroll) {

            localization.bind('firewall', $scope);
            requestContext.setUpRenderContext('firewall.index', $scope);
            $scope.tabFilterDefault = $rootScope.commonConfig('datacenter');
            $scope.openRuleForm = false;

            function scrollTo(id) {
                if ($location.hash() === id) {
                    $location.hash('');
                }

                setTimeout(function () {
                    $scope.$apply(function () {
                        $location.hash(id);
                        $anchorScroll();
                    });
                }, 50);
            }

            $scope.toggleOpenRuleForm = function () {
                $scope.openRuleForm = !$scope.openRuleForm;
                if ($scope.openRuleForm) {
                    $scope.resetData();
                    $scope.selected.datacenter = $rootScope.commonConfig('datacenter') || $scope.datacenter;
                    scrollTo('create-rule');
                }
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
                        return ((vm.id.indexOf(options.term) !== -1) || (vm.text.indexOf(options.term) !== -1)) && vm.datacenter === $scope.tabFilterUpdate || $scope.selected.datacenter;
                    });
                    var tags = $scope.tags.filter(function(tag){
                        return ((tag.id.indexOf(options.term) !== -1) || (tag.text.indexOf(options.term) !== -1)) && tag.datacenter === $scope.tabFilterUpdate || $scope.selected.datacenter;
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

            function reverseQuery(o) {
                o.reverse = true;
                return query(o);
            }

            function extractVmInfo(machines) {
                for(var m in machines) {
                    var machine = machines[m];
                    if (ng.isObject(machine) && machine.firewall_supported) {
                        if(ng.isObject(machine.tags) && Object.keys(machine.tags).length) {
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

            function createCombobox(id, objId, propId, handler, addOnSelect) {
                return $(id).select2({
                    width: '100%',
                    query: handler,
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
                    if (n.parsed && o.parsed && n.parsed.protocol && o.parsed.protocol && n.parsed.protocol.name !== o.parsed.protocol.name && n.uuid == o.uuid) {
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
                if (!n || n === '') {
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
                });
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
                        text: 'vmall'
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
            $scope.datacenters = [];

	        $scope.selectDatacenter = function (name) {
		        $scope.datacenter = name;
	        };

            $scope.selectData = {};
            $scope.selectData.actions = [{
                id:'allow',
                text:'Allow'
            },{
                id:'block',
                text:'Block'
            }];

            $scope.selectData.states = [{
                id: 'true',
                text:'Enabled'
            },{
                id: 'false',
                text:'Disabled'
            }];

            $scope.selectData.protocols = [{
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
                action: $scope.selectData.actions[0].text,
                status: $scope.selectData.states[1].id,
                protocol: $scope.selectData.protocols[0].text
            };

            $scope.refreshSelects = function () {
                // update select2's
                $('#actionSelect').select2('val', $scope.data.parsed.action);
                $scope.selected.status = $scope.data.enabled.toString();
                $('#stateSelect').select2('val', $scope.selected.status);
                $('#protocolSelect').select2('val', $scope.data.parsed.protocol.name);
                $('#dcSelect').select2('enable').select2('val', $scope.selected.datacenter);
            };

            // FIXME: Get rid of copy-paste from provision.js!!!
            var initialDatacenter;
            var switchToOtherDatacenter = function (datacenter) {
                if ($scope.selectData.datacenters && $scope.selectData.datacenters.length > 0) {
                    var firstNonSelected = $scope.selectData.datacenters.find(function (dc) { return dc.text !== datacenter; });
                    if (firstNonSelected) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'machine',
                                'CloudAPI is not responding in the {{name}} data center. Our operations team is investigating.',
                                { name: datacenter }
                            )
                        );

                        if (firstNonSelected.text !== initialDatacenter) {
                            initialDatacenter = initialDatacenter || datacenter;
                            $scope.selected.datacenter = firstNonSelected.text;
                        }
                    }
                }
            };

            // Watch datacenter change
            $scope.$watch('selected.datacenter', function (newVal) {
                if (newVal) {
                    $scope.datasetsLoading = true;
                    Datacenter.datacenterPing(newVal).then(function (result) {
                        if (result === 'pong') {
                            $('#dcSelect').select2('val', newVal);
                            $scope.datacenter = newVal;
                        } else {
                            switchToOtherDatacenter(newVal);
                        }
                    });
                }
                $scope.datasetsLoading = false;
            });

            $scope.$watch('selected.status', function (val) {
                $scope.data.enabled = val === 'true';
            });

            $scope.$watch('datacenters', function (newVal) {
                if(newVal && ng.isArray(newVal) && newVal.length > 0) {
                    $scope.selectData.datacenters = newVal.map(function (dc) { return {id: dc.name, text: dc.name}; });
                    $scope.selected.datacenter = $scope.selected.datacenter || newVal[0].name;
                }
            });

            $scope.setRules = function (rules) {
                var dcRules = [];
                Object.keys(rules).forEach(function (datacenter) {
                    rules[datacenter].forEach(function (dcRule) {
                        dcRule.id = '';
                        dcRule.datacenter = datacenter;
                        dcRules.push(dcRule);
                    });
                });
	            $scope.rules = dcRules;
            };

            // get lists from services
            $scope.loading = true;
            $scope.rules = [];
            $scope.machines = [];
            $scope.machinesLoading = true;
            $scope.notAffectedMachines = [];
            $scope.kvmList = [];
            $scope.firewallDisabledMachines = [];
            $scope.rulesByDatacenter = [];

            $qe.every([
                $q.when(Machine.machine()),
                $q.when(rule.rule()),
                $q.when(Datacenter.datacenter())
            ]).then(function (results) {
                var machineResult = results[0];
                var rulesResult = results[1];
                var datacentersResult = results[2];
                $scope.machines = [];
                $scope.datacenters = [];

                if (machineResult.error) {
                    PopupDialog.errorObj(machineResult.error);
                } else {
                    $scope.machines = machineResult;
                }
                if (rulesResult.error) {
                    PopupDialog.errorObj(rulesResult.error);
                } else {
                    $scope.setRules(rulesResult);
                }

                if (datacentersResult.error) {
                    PopupDialog.errorObj(datacentersResult.error);
                } else {
                    $scope.datacenters = datacentersResult;
                }


                $scope.$watch('machines.final', function(isFinal) {
                    if (isFinal) {
                        extractVmInfo($scope.machines);

                        Object.keys($scope.machines).forEach(function(index) {
                            var m = $scope.machines[index];

                            if (m.id && !m.firewall_supported) {
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
                if ($scope.tabFilterDefault) {
                    $scope.tabFilterUpdate = $scope.tabFilterDefault;
                } else if ($scope.datacenters.length > 0) {
                    $scope.tabFilterUpdate = $scope.datacenters[0].name;
                }
                $scope.$watch('datacenter', function(dc){
                    if(dc) {
                        $scope.resetCurrent('from');
                        $scope.resetCurrent('to');
                        $scope.resetData();
                        $scope.loading = false;
                    }
                });
            }, function (err){
                PopupDialog.errorObj(err);
                $scope.loading = false;
            });

            // rule create/edit form controls

            $scope.resetData = function () {
                $scope.data.id = null;
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
                data.datacenter = $scope.selected.datacenter || $scope.datacenter;
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
                    && targets.indexOf(parseInt($scope.current.port, 0)) === -1) {
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
                PopupDialog.error(
                    localization.translate(
                        $scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        message
                    ), function () {
                        var data = $scope.data.parsed;

                        function setFocus(direction) {
                            var type = $scope.current[direction].type;

                            if (type === 'vm') {
                                ng.element('#s2id_' + direction + 'InstanceSelect').find('a').eq(0).mousedown();
                            } else if (type === 'subnet' || type === 'ip') {
                                ng.element('input[name="' + direction + 'Value"]').focus();
                            } else if (type === 'tag') {
                                ng.element('input[data-ng-model="current.' + direction + '.text"]').focus();
                            } else {
                                ng.element('#s2id_' + direction + 'Select').find('a').eq(0).mousedown();
                            }
                        }

                        if (!data.protocol.targets.length) {
                            ng.element('#port').focus();
                        } else if (!data.from.length) {
                            setFocus('from');
                        } else if (!data.to.length) {
                            setFocus('to');
                        }
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

            $scope.removeFrom = function(index) {
                $scope.data.parsed.from.splice(index, 1);
                if(!$scope.data.parsed.from.length && !$scope.isAny($scope.data.parsed.to[0])) {
                    $scope.data.parsed.from = [];
                }
            };

            $scope.removeProtocolTarget = function(index) {
                $scope.data.parsed.protocol.targets.splice(index, 1);
            };

            $scope.removeTo = function(index) {
                $scope.data.parsed.to.splice(index, 1);
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

            $scope.stringifyRule = function (el, ruleToStringify) {
                if (typeof $scope[ruleToStringify] === 'function') {
                    ruleToStringify = $scope[ruleToStringify]();
                }

                $http.post('./firewall/stringify', ruleToStringify).then(function(response) {
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
                    return false;
                }
                return ($scope.data.uuid ? $scope.updateRule : $scope.createRule)();
            };
            $scope.deleteRule = function(r) {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete firewall rule'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Delete current firewall rule?'
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
                rule.rule().then(function(r){
                    $scope.resetCurrent();
                    $scope.setRules(r);
                    $scope.loading = false;
                    $scope.openRuleForm = false;
                    $scope.data.uuid = '';
                }, $scope.disableLoading);
            };

            if ($scope.features.manta === 'enabled') {
                //TODO: Move to grid-view and use grid id as config id
                $scope.gridUserConfig = Account.getUserConfig().$child('firewall');
            }

	        $scope.gridOrder = [];
	        $scope.gridProps = [
		        {
			        id: 'from',
			        name: 'From',
			        getClass: function () {
				        return 'span2 padding-5';
			        },
			        _getter: function (object) {
				        var arr = object.parsed.from.map(function (fromItem) {
					        return $filter('targetInfo')(fromItem);
				        });
				        return arr.join('; ');
			        },
			        sequence: 5,
                    active: true
		        },
		        {
			        id: 'to',
			        name: 'To',
			        getClass: function () {
				        return 'span2 padding-5';
			        },
			        _getter: function (object) {
				        var arr = object.parsed.to.map(function (toItem) {
					        return $filter('targetInfo')(toItem);
				        });
				        return arr.join('; ');
			        },
			        sequence: 7,
                    active: true
		        },
		        {
			        id: 'parsed',
			        id2: 'action',
			        name: 'Action',
			        getClass: function () {
				        return 'span1 padding-5';
			        },
			        sequence: 6,
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
                    active: false
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
					        return 'btn-edit ci effect-orange-button';
				        },
				        disabled: function () {
					        return $scope.loading;
				        },
				        action: function (object) {
					        $scope.data = rule.cleanRule(object);

                            $scope.refreshSelects();
                            $('#dcSelect').select2('disable');
                            angular.element('#s2id_dcSelect a span').text($scope.data.datacenter);

                            $scope.tabFilterUpdate = $scope.changeTab = $scope.data.datacenter;

                            $scope.openRuleForm = true;

                            scrollTo('edit-rule');
				        },
				        tooltip: 'Edit the rule'
			        },
                    sequence: 7,
                    active: true
		        },
                {
                    id: 'enabled',
                    name: 'Status',
                    columnClass: 'status-column',
                    type: 'progress',
                    _inProgress: function (object) {
                        return (object.job && !object.job.finished) || object.deleteJob;
                    },
                    _getter: function (object) {
                        return object.enabled ? '<span class="grid-enabled-text">Enabled</span>' : '<span class="grid-disabled-text">Disabled</span>';
                    },
                    sequence: 1,
                    active: true
                }
	        ];

            function setRuleState (action, el){
                if (action !== 'deleteRule') {
                    el.job.finished = true;
                    el.checked = false;
                }
            }

            function makeRuleAction(action, msg) {
                if($scope.actionButton()) {
                    var checkedRules = $scope.rules.filter(function (item) {
                        return item.checked;
                    });
                    var message = msg;
                    message += checkedRules.length > 1 ?
                        ' selected rules?':
                        ' selected rule?' ;

                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: ' + message
                        ),
                        localization.translate(
                            $scope,
                            null,
                            message
                        ), function () {
                            var promises = [];
                            checkedRules.forEach(function (el) {
                                if (((action === 'enableRule') !== el.enabled) || (action === 'deleteRule')) {
                                    var deferred = $q.defer();
                                    promises.push(deferred.promise);
                                    el.job = {finished: false};

                                    rule[action](el)
                                        .then(
                                            function () {
                                                deferred.resolve();
                                                setRuleState(action, el);
                                            },
                                            function (err) {
                                                $scope.disableLoading();
                                                deferred.reject(err);
                                                setRuleState(action, el);
                                            }
                                        );
                                }
                                el.checked = false;
                            });
                            $q.all(promises).then(function () {
                                $scope.refresh();
                                $scope.openRuleForm = false;
                            });
                        });
                } else {
                    $scope.noCheckBoxChecked();
                }
            }

            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        makeRuleAction('deleteRule', 'Delete');
                    },
                    sequence: 1
                },
                {
                    label: 'Enable',
                    action: function () {
                        makeRuleAction('enableRule', 'Enable');
                    },
                    sequence: 2
                },
                {
                    label: 'Disable',
                    action: function () {
                        makeRuleAction('disableRule', 'Disable');
                    },
                    sequence: 2
                }
            ];
            $scope.actionButton = function () {
                return $scope.rules.some(function (ruleItem) {
                    return ruleItem.checked === true;
                });
            };
            $scope.noCheckBoxChecked = function () {
                PopupDialog.error(
                    localization.translate(
                        $scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'No rule selected for the action.'
                    ), function() {
                    }
                );
            };

            $scope.changeTab = '';

            $scope.$watch('tabFilterUpdate', function(tab) {
                if (tab) {
                    tab = tab.name || tab;
                    if (!$scope.data.uuid && tab !== 'all') {
                        $scope.datacenter = tab;
                    }
                    if (tab === 'all') {
                        $rootScope.clearCommonConfig('datacenter');
                    } else {
                        $rootScope.commonConfig('datacenter', tab);
                    }
                }
            });

            $scope.$watch('openRuleForm', function(){
                setTimeout(function () {
                    ng.element('#port').focus();
                }, 5);
                if ($scope.openRuleForm === false) {

                    if ($scope.changeTab) {
                        $scope.datacenter = $scope.changeTab;
                    }

                    $scope.tabFilterUpdate = $scope.datacenter;

                    $('#dcSelect').select2('enable');
                    $scope.changeTab = '';
                    $scope.data.uuid = '';
                }
            });

            $scope.cancelRule = function () {
                $scope.resetData();
                $scope.openRuleForm = false;
            };

            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter rules';
            $scope.searchForm = true;
            $scope.exportFields = {
                ignore: []
            };
        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
