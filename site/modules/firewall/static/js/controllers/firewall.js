'use strict';

(function (ng, app) {
    app.filter('targetInfo', function() {
        return function(target) {
            if(target[0] === 'wildcard' && target[1] === 'any') {
                return 'ANY';
            }
            if(target[0] === 'tag' && ng.isArray(target[1])) {
                return target[0] + ': ' + target[1][0] + ' = ' + target[1][1];
            }
            return target[0] + ': ' + target[1];
        };
    });
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

        function ($scope, Datacenter, $cookieStore, $filter, requestContext, localization, rule, $q, Machine) {

            localization.bind('firewall', $scope);
            requestContext.setUpRenderContext('firewall.index', $scope);

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

            $scope.$watch('data.parsed.protocol.name', function(name) {
                if(name) {
                    $scope.clearProtocolTargets();
                }
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
                $scope.rules = rules[$scope.datacenter];
                $scope.search();
            }

            // get lists from services
            $scope.rules = [];
            $scope.machines = Machine.machine();
            $scope.rulesByDatacenter = rule.rule();
            $q.all([
                $q.when($scope.machines),
                $q.when($scope.rulesByDatacenter),
                $q.when($scope.datacenters)
            ]).then(function(lists){
                $scope.datacenter = lists[2][0];
                $scope.$watch('datacenter', function(dc){

                    if(dc) {

                        $scope.setRules(lists[1]);

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

            $scope.getData = function() {
                return {
                    uuid: $scope.data.uuid,
                    datacenter: $scope.data.datacenter,
                    enabled: $scope.data.enabled,
                    parsed: {
                        from: $scope.data.parsed.from,
                        to: $scope.data.parsed.to,
                        action: $scope.data.parsed.action,
                        protocol: {
                            name: $scope.data.parsed.protocol.name,
                            targets: $scope.data.parsed.protocol.targets
                        }
                    }
                };
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

            $scope.addPort =function() {
                $scope.data.parsed.protocol.targets.push($scope.current.port);
                $scope.current.port = '';
                $scope.rule.port.$setValidity('range', false);
            };

            $scope.addType = function() {
                var target = $scope.current.type;
                if($scope.current.code || $scope.current.code === 0) {
                    target+= ':' + $scope.current.code;
                }
                $scope.data.parsed.protocol.targets.push(target);
                $scope.current.type = 0;
                $scope.current.code = null;
                $scope.rule.code.$setValidity('range', false);
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

            $scope.editRule = function(r) {
                $scope.data.uuid = r.uuid;
                $scope.data.datacenter = r.datacenter;
                $scope.data.parsed = {
                    from: r.parsed.from,
                    to: r.parsed.to,
                    action: r.parsed.action,
                    protocol: r.parsed.protocol
                };
                $scope.data.enabled = r.enabled;
            };

            // Rule controls to interact with service

            // Temporary solution for updating rule information
            // deletes old rule and creates new modified rule
            $scope.updateRule = function() {
                $scope.loading = true;
                rule.deleteRule($scope.getData()).then(function(){
                    var r = $scope.getData();
                    delete r.uuid;
                    rule.createRule(r).then(function(){
                        $scope.refresh();
                    })
                });

            };
            $scope.deleteRule = function(r) {
                $scope.loading = true;
                rule.deleteRule(r).then(function(){
                    $scope.refresh();
                });
            };

            $scope.changeStatus = function(r) {
                $scope.loading = true;
                if(r.enabled) {
                    rule.disableRule(r).then(function() {
                        $scope.refresh();
                    });
                } else {
                    rule.enableRule(r).then(function() {
                        $scope.refresh();
                    });
                }
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
            $scope.createRule = function() {
                $scope.loading = true;
                rule.createRule($scope.getData()).then(function(r){
                    if(r.id) {
                        $scope.refresh();
                    }
                })
            };

            // Sorting
            $scope.sortingOrder = null;
            $scope.reverse = true;

            $scope.sortable = [
                { title: 'Action', value: 'parsed.action' },
                { title: 'Protocol', value: 'parsed.protocol.name' },
                { title: 'Active', value: 'enabled' }
            ];
            $scope.sortField = $scope.sortable[2];

            // Pagination
            $scope.itemsPerPage = 5;
            $scope.pagedItems = [];
            $scope.showAllActive = false;
            $scope.maxPages = 5;
            $scope.currentPage = 0;

            $scope.filteredItems = [];

            // Controller methods
            // Sorting
            // change sorting order
            var __fieldName;
            $scope.sortBy = function (fieldName, changeDirection) {
                $scope.reverse = __fieldName === fieldName ? !$scope.reverse : false;
                __fieldName = fieldName;

                // Assume that filter method will find least one matching item
                try {
                    $scope.sortField = $scope.sortable.filter(function (item) {
                        return fieldName === item.value;
                    })[0];
                    $cookieStore.put('sortField', fieldName);
                    $cookieStore.put('sortDirection', $scope.reverse);
                } catch (e) {
                    // Cannot change sorting field, ignore
                    return;
                }

                var oldFieldName = $scope.sortingOrder;
                $scope.sortingOrder = fieldName;
                $scope.search((oldFieldName != fieldName));
            };

            // Searching
            $scope.search = function (changePage) {
                // filter by search term
                var oldMachineCount = $scope.filteredItems.length;
                $scope.filteredItems = $scope.rules;

                // take care of the sorting order
                if ($scope.sortingOrder !== '') {
                    $scope.filteredItems = $filter('orderBy')(
                        $scope.filteredItems,
                        $scope.sortingOrder,
                        $scope.reverse);
                }

                if (changePage || !$scope.filteredItems || oldMachineCount !== $scope.filteredItems.length) {
                    $scope.currentPage = 0;
                }

                $scope.groupToPages();
                $scope.$watch('machines.final', function(newval) {
                    if (newval && $scope.loading) {
                        $scope.loading = false;
                    }
                })
            };
            // Pagination
            // calculate page in place
            $scope.groupToPages = function () {
                $scope.pagedItems = [];

                var i;
                for (i = 0; i < $scope.filteredItems.length; i++) {
                    var index = Math.floor(i / $scope.itemsPerPage);
                    if (i % $scope.itemsPerPage === 0) {
                        $scope.pagedItems[index] = [$scope.filteredItems[i]];
                    } else {
                        $scope.pagedItems[index].push($scope.filteredItems[i]);
                    }
                }
            };

            // get pagination range
            $scope.range = function () {
                var ret = [];

                var start = $scope.currentPage - Math.floor($scope.maxPages / 2);
                var end = $scope.currentPage + Math.ceil($scope.maxPages / 2);

                if (end > $scope.pagedItems.length) {
                    end = $scope.pagedItems.length;
                    if (end - $scope.maxPages >= 0) {
                        start = end - $scope.maxPages;
                    }
                }

                if (start < 0) {
                    start = 0;
                    if (start + $scope.maxPages <= $scope.pagedItems.length) {
                        end = start + $scope.maxPages;
                    }
                }

                // add first page
                ret.push(0);
                for (var i = start; i < end; i++) {
                    // don't duplicate first or last page
                    if(i != 0 && i != $scope.pagedItems.length-1)
                        ret.push(i);
                }

                // add last page
                if ($scope.pagedItems.length > 1) {
                    ret.push($scope.pagedItems.length-1);
                }

                return ret;
            };


            // put all machines to one page
            $scope.showAll = function() {
                $scope.itemsPerPage = 9999;
                $scope.maxPages = 1;
                $scope.currentPage = 0;
                $scope.showAllActive = true;
                $scope.groupToPages();
            };

            $scope.showPages = function() {
                $scope.itemsPerPage = 5;
                $scope.maxPages = 5;
                $scope.currentPage = 0;
                $scope.showAllActive = false;
                $scope.groupToPages();
            };

            $scope.prevPage = function () {
                if ($scope.currentPage > 0) {
                    $scope.currentPage--;
                }
            };

            $scope.nextPage = function () {
                if ($scope.currentPage < $scope.pagedItems.length - 1) {
                    $scope.currentPage++;
                }
            };

            $scope.setPage = function () {
                $scope.currentPage = this.n;
            };

            if (!$scope.sortingOrder) {
                $scope.reverse = $cookieStore.get('sortDirection') || false;
                $scope.sortBy($cookieStore.get('sortField') || $scope.sortField.value, false);
            }

        }

    ]);
}(window.angular, window.JP.getModule('firewall')));
