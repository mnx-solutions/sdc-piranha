'use strict';

(function (ng, app) {

    function equalArrays(array1, array2) {
        if (!array2 || array1.length !== array2.length) {
            return false;
        }

        for (var i = 0, l = array1.length; i < l; i++) {
            if (array1[i] instanceof Array && array2[i] instanceof Array &&
                !equalArrays(array1[i], array2[i]) ||
                array1[i] != array2[i]) {
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

        function ($scope, $rootScope, $filter, $q, $qe, requestContext, localization, rule, Image, Datacenter, Machine,
                  $http, PopupDialog, Account, $location, $anchorScroll) {

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

            $scope.changeItem = function (selectedItem, direction) {
                if (!direction || !selectedItem || !selectedItem.id) {
                    return;
                }
                $scope.current[direction] = ng.fromJson(selectedItem.id);
            };

            function query(options, type) {
                if (!type) {
                    type = false;
                }
                var results = [];

                if (options.term === '' && !type) {
                    results = ng.copy($scope.dropdown);
                    if (options.reverse) {
                        results[0].children.reverse();
                    }
                } else {
                    var vms = $scope.vms.filter(function (vm) {
                        return (vm.id.indexOf(options.term) !== -1 || vm.text.indexOf(options.term) !== -1) && vm.datacenter === ($scope.data.uuid ? $scope.data.datacenter : $scope.selected.datacenter);
                    });
                    var tags = $scope.tags.filter(function (tag) {
                        return (tag.id.indexOf(options.term) !== -1 || tag.text.indexOf(options.term) !== -1) && tag.datacenter === ($scope.data.uuid ? $scope.data.datacenter : $scope.selected.datacenter);
                    });

                    results = [{
                        text: 'Instances',
                        children: vms
                    }, {
                        text: 'Tags',
                        children: tags
                    }];

                    if (type == 'Instances') {
                        results = [results[0]];
                    }

                    if (type == 'Tags') {
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
                for (var m in machines) {
                    var machine = machines[m];
                    if (ng.isObject(machine) && machine.firewall_supported) {
                        if (ng.isObject(machine.tags) && Object.keys(machine.tags).length) {
                            for (var tag in machine.tags) {
                                if ($scope.tags.indexOf(tag) === -1) {
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

            $scope.CIDRs = [];
            for (var i = 0; i <= 32; i++) {
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

            $scope.$watch('data', function (n, o) {
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
                    if (!data.parsed.protocol || !data.parsed.protocol.name || !data.parsed.protocol.targets ||
                        data.parsed.protocol.targets.length === 0) {
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

            $scope.$watch('fromSubnet', function (n) {
                if (n.CIDR && n.address) {
                    $scope.current.from.text = n.address + '/' + n.CIDR;
                }
            }, true);

            $scope.$watch('toSubnet', function (n) {
                if (n.CIDR && n.address) {
                    $scope.current.to.text = n.address + '/' + n.CIDR;
                }
            }, true);

            $scope.$watch('current.code', function (n) {
                if (!n || n === '') {
                    $scope.protocolForm.code.$setValidity('range', true);
                }
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
                        text: 'any'
                    }),
                    text: 'Any'
                }, {
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

            $scope.selectData = {};
            $scope.selectData.actions = [{
                id:'allow',
                text:'Allow'
            }, {
                id:'block',
                text:'Block'
            }];

            $scope.selectData.states = [{
                id: 'true',
                text:'Enabled'
            }, {
                id: 'false',
                text:'Disabled'
            }];

            $scope.selectData.protocols = [{
                id:'tcp',
                text:'TCP'
            }, {
                id:'udp',
                text:'UDP'
            }, {
                id:'icmp',
                text:'ICMP'
            }];

            $scope.selected = {
                action: $scope.selectData.actions[0].text,
                status: $scope.selectData.states[1].id,
                protocol: $scope.selectData.protocols[0].text
            };

            $scope.refreshSelects = function () {
                $scope.resetCurrent('from');
                $scope.resetCurrent('to');
                $scope.current.port = null;
                $scope.selected.status = $scope.data.enabled.toString();
                $scope.disableSelect = false;
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
                                {name: datacenter}
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
                if (newVal && ng.isArray(newVal) && newVal.length > 0) {
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

                            if (m.id && !m.hasOwnProperty('firewall_enabled')) {
                                $scope.notAffectedMachines.push(m);
                                return;
                            }

                            if (m.id && m.firewall_enabled === false) {
                                $scope.firewallDisabledMachines.push(m);
                            }
                        });

                        $scope.machinesLoading = false;
                    }
                });
                if ($scope.tabFilterDefault) {
                    $scope.tabFilterUpdate = $scope.tabFilterDefault;
                }
                $scope.$watch('datacenter', function(dc) {
                    if (dc && $scope.loading) {
                        $scope.resetCurrent('from');
                        $scope.resetCurrent('to');
                        $scope.resetData();
                        $scope.loading = false;
                    }
                });
            }, function (err) {
                PopupDialog.errorObj(err);
                $scope.loading = false;
            });

            // rule create/edit form controls

            $scope.resetData = function () {
                $scope.data.id = null;
                $scope.data.uuid = null;
                $scope.data.description = null;
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
                data.description = $scope.data.description || '';
                return data;
            };

            $scope.resetCurrent = function (direction) {
                if (!direction) {
                    $scope.resetCurrent('from');
                    $scope.resetCurrent('to');
                }
                $scope.current[direction + 'Select'] = null;
                $scope.current[direction + 'VM'] = null;
                $scope.current[direction] = {
                    type: 'wildcard',
                    value: null
                };
                $scope[direction + 'Subnet'] = {
                    address: null,
                    CIDR: 32
                };
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

            $scope.addPort = function () {
                var targets = $scope.data.parsed.protocol.targets;

                if ($scope.isAllPorts()) {
                    targets.length = 0;
                }

                if (targets.indexOf($scope.current.port) === -1 &&
                    targets.indexOf(parseInt($scope.current.port, 10)) === -1) {
                    targets.push($scope.current.port);
                }
                $scope.current.port = '';
                $scope.current.allPorts = false;
                $scope.protocolForm.port.$setValidity('range', false);
            };

            $scope.addType = function () {
                var target = $scope.current.type;
                if ($scope.current.code || $scope.current.code === 0) {
                    target += ':' + $scope.current.code;
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
                            setTimeout(function () {
                                switch ($scope.current[direction].type) {
                                    case 'vm':
                                        ng.element('#' + direction + 'VM').find('a').click();
                                        break;
                                    case 'subnet', 'ip':
                                        ng.element('input[name="' + direction + 'Value"]').focus();
                                        break;
                                    case 'tag':
                                        ng.element('input[data-ng-model="current.' + direction + '.text"]').focus();
                                        break;
                                    default :
                                        ng.element('#' + direction + 'Select').find('a').click();
                                }
                            });
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
                if (!$scope.data.parsed.from.length && !$scope.isAny($scope.data.parsed.to[0])) {
                    $scope.data.parsed.from = [];
                }
            };

            $scope.removeProtocolTarget = function(index) {
                $scope.data.parsed.protocol.targets.splice(index, 1);
            };

            $scope.removeTo = function(index) {
                $scope.data.parsed.to.splice(index, 1);
                if (!$scope.data.parsed.to.length && !$scope.isAny($scope.data.parsed.from[0])) {
                    $scope.data.parsed.to = [];
                }
            };

            $scope.isAny = function(target) {
                // handle array
                if (ng.isArray(target) && target.length === 2) {
                    return target[0] === 'wildcard' && target[1] === 'any';

                // handle object
                }
                if (ng.isObject(target)) {
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

            $scope.createRule = function () {
                $scope.loading = true;
                rule.createRule($scope.getData()).then(function (r) {
                    if (r.id) {
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
            $scope.deleteRule = function (r) {
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
                        rule.deleteRule(r).then(function () {
                            $scope.refresh();
                        }, $scope.disableLoading);
                        $scope.openRuleForm = false;
                    });
            };

            $scope.changeStatus = function (r) {
                $scope.loading = true;
                var fn = r.enabled ? 'disableRule' : 'enableRule';
                rule[fn](r).then(function() {
                    $scope.refresh();
                });
            };

            $scope.refresh = function () {
                rule.rule().then(function (r) {
                    $scope.resetCurrent();
                    $scope.setRules(r);
                    $scope.loading = false;
                    $scope.openRuleForm = false;
                    $scope.data.uuid = '';
                    $scope.data.description = '';
                }, $scope.disableLoading);
            };

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = 'firewall';
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
                    _export: function (object) {
                        return object.parsed.action || '';
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
                            return 'btn grey';
                        },
                        disabled: function () {
                            return $scope.loading;
                        },
                        action: function (object) {
                            $scope.refreshSelects();
                            $scope.data = rule.cleanRule(object);
                            $scope.disableSelect = true;

                            $scope.tabFilterUpdate = $scope.changeTab = $scope.selected.datacenter =
                                $scope.data.datacenter;

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
                    _export: function (object) {
                        return ng.element(this._getter(object)).text() || this._getter(object);
                    },
                    _inProgress: function (object) {
                        return (object.job && !object.job.finished) || object.deleteJob;
                    },
                    _getter: function (object) {
                        return object.enabled ? '<span class="grid-enabled-text">Enabled</span>' : '<span class="grid-disabled-text">Disabled</span>';
                    },
                    sequence: 1,
                    active: true
                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 8,
                    active: true,
                    columnClass: 'description-column'
                }
            ];

            function setRuleState (action, el) {
                if (action !== 'deleteRule') {
                    el.job.finished = true;
                    el.checked = false;
                }
            }

            function makeRuleAction(action, msg) {
                if ($scope.actionButton()) {
                    var checkedRules = $scope.rules.filter(function (item) {
                        return item.checked;
                    });
                    var message = msg;
                    message += checkedRules.length > 1 ?
                        ' selected rules?' :
                        ' selected rule?';

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
                PopupDialog.noItemsSelectedError('rule');
            };

            $scope.changeTab = '';

            $scope.tabFilterField = 'datacenter';
            $scope.$on('gridViewChangeTab', function (event, tab) {
                if (tab === 'all') {
                    $rootScope.clearCommonConfig($scope.tabFilterField);
                } else {
                    $rootScope.commonConfig($scope.tabFilterField, tab);
                }
            });

            $scope.$watch('openRuleForm', function() {
                setTimeout(function () {
                    ng.element('#port').focus();
                }, 5);
                if ($scope.openRuleForm === false) {

                    if ($scope.changeTab) {
                        $scope.datacenter = $scope.changeTab;
                    }

                    $scope.tabFilterUpdate = $scope.datacenter;

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
                ignore: ['Edit']
            };
        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
