'use strict';

(function (ng, app) {
    app.controller('Machine.IndexController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$dialog',
        '$q',
        'requestContext',
        'Machine',
        'Dataset',
        'Package',
        'localization',
        'util',
        '$http',

        function ($scope, $cookieStore, $filter, $$track, $dialog, $q, requestContext, Machine, Dataset, Package, localization, util, $http) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.index', $scope, {
                title: localization.translate(null, 'machine', 'See my Joyent Instances')
            });

            $scope.listTypes = [ 'normal', 'alternate' ];
            $scope.listType = $scope.listTypes[0]; // Defaults to 'normal'

            // Sorting
            $scope.sortingOrder = null;
            $scope.reverse = true;

            $scope.sortable = [
                { title: 'Name', value: 'label' },
                { title: 'Datacenter', value: 'datacenter' },
                { title: 'Created', value: 'created' },
                { title: 'IP', value: 'ips[0]' },
                { title: 'State', value: 'state' },
                { title: 'Tags', value: 'tags.tags' }
            ];
            $scope.sortField = $scope.sortable[2];

            $scope.loading = true;

            // Pagination
            $scope.groupedMachines = [];
            $scope.itemsPerPage = 5;
            $scope.pagedMachines = [];
            $scope.collapsedMachines = {};
            $scope.showAllActive = false;
            $scope.maxPages = 5;
            $scope.currentPage = 0;
            $scope.machines = Machine.machine();
            $scope.packages = Package.package();

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.machines = Machine.machine();
                }
            );

            $scope.$watch('machines', function (machines) {
                machines.forEach(function (machine) {
                    Dataset.dataset(machine.image).then(function (dataset) {
                        machine.dataset = dataset;
                    });
                });

                $scope.search();
            }, true);

            $scope.$watch('machines.final', function(final) {
                if(final) {
                    $scope.packages.then(function () {
                        $scope.loading = false;
                    });
                }
            });

            // Searching
            $scope.searchOptions = {
                All: [
                    'created', 'id', 'name',
                    'type', 'dataset', 'ips',
                    'memory', 'disk', 'metadata',
                    'datacenter','tags.tags'
                ],
                Visible: [
                    'created', 'id', 'name',
                    'ips', 'datacenter', 'tags.tags'
                ],
                Name: ['id', 'name'],
                Type: ['type'],
                Ip: ['ips'],
                Memory: ['memory'],
                Datacenter: ['datacenter'],
                Tags: ['tags.tags']
            };

            $scope.searchable = $scope.searchOptions.Visible;
            $scope.filteredMachines = [];

            var _labelMachines = function (machines) {
                for (var machine in machines) {
                    if (machines[machine].name) {
                        machines[machine].label = machines[machine].name;
                    } else {
                        machines[machine].label = machines[machine].id;
                    }
                }

                return machines;
            };

            var _filter = function (subject) {
                var searchMatch = function (haystack, needle) {
                    if (!needle) {
                        return true;
                    }

                    var helper = haystack;
                    if (ng.isNumber(haystack)) {
                        helper = haystack.toString();
                    }

                    var subject = helper.toLowerCase();
                    return (subject.indexOf(needle.toLowerCase()) !== -1);
                };

                var ret = $filter('filter')(subject, function (item) {
                    var attrKey;
                    for (attrKey in item) {
                        var attr = item[attrKey];
                        if ($scope.searchable.indexOf(attrKey) === -1) {
                            continue;
                        }

                        // handle up to 2 dimensional searching
                        if (ng.isObject(attr) || ng.isArray(attr)) {
                            var child;
                            for (child in attr) {
                                if (ng.isString(attr[child]) || ng.isNumber(attr[child])) {
                                    if (searchMatch(attr[child], $scope.query)) {
                                        return true;
                                    }
                                }
                            }

                        } else if (ng.isString(attr) || ng.isNumber(attr)) {
                            if (searchMatch(attr, $scope.query)) {
                                return true;
                            }
                        }
                    }

                    return (false);
                });

                return (_labelMachines(ret));
            };

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

                // OLD stuff
                $scope.sortIcon = {};
                $scope.sortIcon[fieldName] = $scope.reverse ? 'down' : 'up';
            };

            $scope.loading = true;

            $scope.CheckBoxCur = {};
            $scope.selectAllCheckbox = function () {
                $scope.checkedCheckBox = ($scope.checkedCheckBox) ? false : true;
                for (var i =0; i<$scope.machines.length;i++){
                    $scope.CheckBoxCur[$scope.machines[i].id] = $scope.checkedCheckBox;
                }
            };
            $scope.checkAllCheckbox = function(){
                var check = 0;
                for (var i =0; i<$scope.machines.length;i++){
                    if($scope.CheckBoxCur[$scope.machines[i].id]){check+=1}
                }
                if(check == 0){$scope.checkedCheckBox = false}
            };
            $scope.selectCheckbox = function (id) {
                $scope.CheckBoxCur[id] = ($scope.CheckBoxCur[id]) ? false : true;
                $scope.checkAllCheckbox();
                return $scope.CheckBoxCur[id];
            };
            $scope.columnsCheckBoxCur = {
                0: true,
                1: true,
                2: true,
                3: true,
                4: true,
                5: false
            };
            $scope.selectColumnsCheckbox = function(id){
                $scope.columnsCheckBoxCur[id] = ($scope.columnsCheckBoxCur[id]) ? false : true;
                return $scope.columnsCheckBoxCur[id];
            };


            // Searching
            $scope.search = function (changePage) {
                // filter by search term
                var oldMachineCount = $scope.filteredMachines.length;
      // temp object for test START //
                $scope.machines =
                    [
                        {
                            "id": "1a32e0ed-9939-4fb5-9ef7-3cace4808f4a01",
                            "name": "Test1",
                            "type": "smartmachine",
                            "state": "stopped",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.115.215",
                                "10.112.1.200"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:41:17.000Z",
                            "updated": "2013-09-05T15:42:18.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.115.215",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        },
                        {
                            "id": "020588c2-0fad-47d7-a324-6b3fa17ef82902",
                            "name": "Test2",
                            "type": "smartmachine",
                            "state": "running",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.113.176",
                                "10.112.2.75"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:47:53.000Z",
                            "updated": "2013-09-05T15:48:50.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.113.176",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        },
                        {
                            "id": "1a32e0ed-9939-4fb5-9ef7-3cace4808f4a03",
                            "name": "Test3",
                            "type": "smartmachine",
                            "state": "stopped",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.115.215",
                                "10.112.1.200"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:41:17.000Z",
                            "updated": "2013-09-05T15:42:18.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.115.215",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        },
                        {
                            "id": "020588c2-0fad-47d7-a324-6b3fa17ef82904",
                            "name": "Test4",
                            "type": "smartmachine",
                            "state": "running",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.113.176",
                                "10.112.2.75"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:47:53.000Z",
                            "updated": "2013-09-05T15:48:50.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.113.176",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        },
                        {
                            "id": "1a32e0ed-9939-4fb5-9ef7-3cace4808f4a05",
                            "name": "Test12",
                            "type": "smartmachine",
                            "state": "stopped",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.115.215",
                                "10.112.1.200"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:41:17.000Z",
                            "updated": "2013-09-05T15:42:18.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.115.215",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        },
                        {
                            "id": "020588c2-0fad-47d7-a324-6b3fa17ef82906",
                            "name": "Test22",
                            "type": "smartmachine",
                            "state": "running",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.113.176",
                                "10.112.2.75"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:47:53.000Z",
                            "updated": "2013-09-05T15:48:50.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.113.176",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        },
                        {
                            "id": "1a32e0ed-9939-4fb5-9ef7-3cace4808f4a07",
                            "name": "Test33",
                            "type": "smartmachine",
                            "state": "stopped",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.115.215",
                                "10.112.1.200"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:41:17.000Z",
                            "updated": "2013-09-05T15:42:18.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.115.215",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        },
                        {
                            "id": "020588c2-0fad-47d7-a324-6b3fa17ef82908",
                            "name": "Test42",
                            "type": "smartmachine",
                            "state": "running",
                            "image": "e3364212-05c0-11e3-9576-3f3ee9e951a7",
                            "ips": [
                                "72.2.113.176",
                                "10.112.2.75"
                            ],
                            "memory": 256,
                            "disk": 16384,
                            "metadata": {
                                "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEArdH8pWHeft+S5kPQtlbi/nc3oPXrpycwansQMI8ERTGX+GSpKNEjdyfPCuhWkO+QEygz3rn8g2PrVGlvIdLGcS19vvuJmdys41ZZoSwTbJBtzsq2hZzUBbsRyHBMFyyARQ8fM+/6NZdeDyyZeoOrsZbiWd6nwWw+InvMeGj8OmU= joyent-silvertree-dev\n",
                                "credentials": []
                            },
                            "tags": {},
                            "credentials": "true",
                            "created": "2013-09-05T15:47:53.000Z",
                            "updated": "2013-09-05T15:48:50.000Z",
                            "dataset": "sdc:sdc:base:13.2.0",
                            "primaryIp": "72.2.113.176",
                            "firewall_enabled": false,
                            "package": "g3-standard-0.25-smartos",
                            "datacenter": "us-east-1"
                        }
                    ];

                $scope.filteredMachines = _filter($scope.machines);

                // take care of the sorting order
                if ($scope.sortingOrder !== '') {
                    $scope.filteredMachines = $filter('orderBy')(
                        $scope.filteredMachines,
                        $scope.sortingOrder,
                        $scope.reverse);
                }

                if (changePage || oldMachineCount != $scope.filteredMachines.length) {
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
                $scope.pagedMachines = [];

                var i;
                for (i = 0; i < $scope.filteredMachines.length; i++) {
                    var index = Math.floor(i / $scope.itemsPerPage);
                    if (i % $scope.itemsPerPage === 0) {
                        $scope.pagedMachines[index] = [$scope.filteredMachines[i]];
                    } else {
                        $scope.pagedMachines[index].push($scope.filteredMachines[i]);
                    }
                }
                $scope.groupToPagesInfo();
            };
            $scope.groupToPagesInfo = function(){
                $scope.pageNumFirst = ($scope.currentPage *$scope.itemsPerPage)+1;
                if ($scope.filteredMachines.length < ($scope.currentPage+1)*$scope.itemsPerPage){
                    $scope.pageNumLast = $scope.filteredMachines.length;
                }else{
                    $scope.pageNumLast = ($scope.currentPage+1) * $scope.itemsPerPage;
                }
                $scope.pageNumSum = $scope.filteredMachines.length;
            };

            // get pagination range
            $scope.range = function () {
                var ret = [];

                var start = $scope.currentPage - Math.floor($scope.maxPages / 2);
                var end = $scope.currentPage + Math.ceil($scope.maxPages / 2);

                if (end > $scope.pagedMachines.length) {
                    end = $scope.pagedMachines.length;
                    if (end - $scope.maxPages >= 0) {
                        start = end - $scope.maxPages;
                    }
                }

                if (start < 0) {
                    start = 0;
                    if (start + $scope.maxPages <= $scope.pagedMachines.length) {
                        end = start + $scope.maxPages;
                    }
                }

                // add first page
                ret.push(0);
                for (var i = start; i < end; i++) {
                    // don't duplicate first or last page
                    if(i != 0 && i != $scope.pagedMachines.length-1)
                        ret.push(i);
                }

                // add last page
                if ($scope.pagedMachines.length > 1) {
                    ret.push($scope.pagedMachines.length-1);
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
                var itemNum = this.select2;
                if(itemNum == 'All'){
                    $scope.showAll();
                    return;
                }
                if($scope.itemsPerPage == undefined || itemNum == undefined) { $scope.itemsPerPage = 5;};
                $scope.itemsPerPage = itemNum;
                $scope.maxPages = 5;
                $scope.currentPage = 0;
                $scope.showAllActive = false;
                $scope.groupToPages();
            };

            /* export current machines */
            $scope.exportDetails = function() {
                var order = [];
                var ignoredValues = ['metadata'];
                var exportData = $scope.machines;

                if ($scope.machines[0]) {
                    Object.keys($scope.machines[0]).forEach(function(key) {
                        // if it's not an ignored field
                        if (ignoredValues.indexOf(key) === -1) {
                            order.push(key);
                        }
                    });
                }

                // filter out ignored fields
                exportData.forEach(function(el) {
                    ignoredValues.forEach(function(e) {
                        delete el[e];
                    });
                });

                $http.post('machine/export', {data: exportData, order: order})
                    .success(function (id) {
                        $scope.exportIframe = '<iframe src="machine/export/' + id + '/csv"></iframe>';
                    })
                    .error(function () {
                        console.error('err', arguments);
                    });
            };

            $scope.prevPage = function () {
                if ($scope.currentPage > 0) {
                    $scope.currentPage--;
                }
                $scope.groupToPagesInfo();
            };

            $scope.nextPage = function () {
                if ($scope.currentPage < $scope.pagedMachines.length - 1) {
                    $scope.currentPage++;
                }
                $scope.groupToPagesInfo();
            };

            $scope.setPage = function () {
                $scope.currentPage = this.n;
            };

            $scope.startMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Start instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance'
                    ), function () {
                        $$track.event('machine', 'start');
                        Machine.startMachine(id);
                    });
            };

            $scope.stopMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Stop instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Stopping an instance does not stop billing, your instance can be restarted after it is stopped.'
                    ), function () {
                        Machine.stopMachine(id);
                        $$track.event('machine', 'stop');
                    });
            };

            $scope.deleteMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Destroy the information on this instance and stop billing for this instance.'
                    ), function () {
                        $$track.event('machine', 'delete');
                        Machine.deleteMachine(id);
                    });
            };

            $scope.rebootMachine = function (id) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Restart instance'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Restart this instance'
                    ), function() {
                        $$track.event('machine', 'reboot');
                        Machine.rebootMachine(id);
                    });
            };

            $scope.toggleMachine = function (id) {
                if ($scope.isCollapsed(id)) {
                    $scope.collapsedMachines[id] = false;
                } else {
                    $scope.collapsedMachines[id] = true;
                }
            };

            $scope.isCollapsed = function (id) {
                return !$scope.collapsedMachines.hasOwnProperty(id) ||
                    $scope.collapsedMachines[id];
            };

            $scope.changeListType = function (type) {
                if ($scope.listTypes.indexOf(type) !== -1) {
                    $scope.listType = type;
                    $cookieStore.put('listType', type);
                }
            };

            if (!$scope.sortingOrder) {
                $scope.reverse = $cookieStore.get('sortDirection') || false;
                $scope.sortBy($cookieStore.get('sortField') || $scope.sortField.value, false);
            }

            // Retrieve selected list type from the cookie or use default fallback
            $scope.changeListType($cookieStore.get('listType') || $scope.listType);
        }

    ]);
}(window.angular, window.JP.getModule('Machine')));
