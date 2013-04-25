'use strict';

(function (ng, app) {
    app.controller(
        'Machine.IndexController',
        [
            '$scope',
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

            function ($scope, $filter, $$track, $dialog, $q, requestContext, Machine, Dataset, Package, localization, util) {
                localization.bind('machine', $scope);
                requestContext.setUpRenderContext('machine.index', $scope);

                // Sorting
                $scope.sortingOrder = null;
                $scope.reverse = true;
                $scope.sortIcon = {};

                // Pagination
                $scope.groupedMachines = [];
                $scope.itemsPerPage = 10;
                $scope.pagedMachines = [];
                $scope.collapsedMachines = {};
                $scope.maxPages = 5;
                $scope.currentPage = 0;
                $scope.machines = Machine.machine();
                $scope.packages = Package.package();

                var confirm = function (question, callback) {
                    var title = 'Confirm';
                    var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                    $dialog.messageBox(title, question, btns)
                        .open()
                        .then(function(result){
                            if(result ==='ok'){
                                callback();
                            }
                        });
                };

                $scope.$on(
                    'event:forceUpdate',
                    function () {
                        $scope.machines = Machine.machine();
                    }
                );

                $scope.checked = {};
                $scope.ischecked = false;

                $scope.$watch('machines', function (machines) {
                    machines.forEach(function (machine) {
                        Dataset.dataset(machine.image).then(function (dataset) {
                            machine.dataset = dataset;
                        });
                    });

                    $scope.search();
                }, true);

                // Searching
                $scope.searchOptions = {
                    All: [
                        'created', 'id', 'name',
                        'type', 'dataset', 'ips',
                        'memory', 'disk', 'metadata',
                        'datacenter'
                    ],
                    Name: ['id', 'name'],
                    Type: ['type'],
                    Ip: ['ips'],
                    Memory: ['memory'],
                    Datacenter: ['datacenter']
                };
                $scope.searchable = $scope.searchOptions.All;
                $scope.filteredMachines = [];

                var searchMatch = function (haystack, needle) {
                    if (!needle) {
                        return (true);
                    }
                    var helper = haystack;
                    if (ng.isNumber(haystack)) {
                        helper = haystack.toString();
                    }
                    var subject = helper.toLowerCase();

                    return (subject.indexOf(needle.toLowerCase()) !== -1);
                };
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
                $scope.sortBy = function (newSortingOrder) {
                    $scope.reverse = !$scope.reverse;
                    $scope.sortingOrder = newSortingOrder;
                    $scope.search();
                    $scope.sortIcon = {};

                    if ($scope.reverse) {
                        $scope.sortIcon[newSortingOrder] = 'down';
                    } else {
                        $scope.sortIcon[newSortingOrder] = 'up';
                    }
                };
                $scope.initializing = true;
                // Searching
                $scope.search = function () {
                    // filter by search term
                    $scope.filteredMachines = _filter($scope.machines);

                    // take care of the sorting order
                    if ($scope.sortingOrder !== '') {
                        $scope.filteredMachines = $filter('orderBy')(
                            $scope.filteredMachines,
                            $scope.sortingOrder,
                            $scope.reverse);
                    }
                    $scope.currentPage = 0;
                    $scope.groupToPages();

                    $q.when($scope.machines, function(machines) {
                        if(machines.final && $scope.initializing) {
                            $scope.initializing = false;
                        }

                    });
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
                    var i;
                    for (i = start; i < end; i++) {
                        ret.push(i);
                    }
                    return ret;
                };

                $scope.prevPage = function () {
                    if ($scope.currentPage > 0) {
                        $scope.currentPage--;
                    }
                };

                $scope.nextPage = function () {
                    if ($scope.currentPage < $scope.pagedMachines.length - 1) {
                        $scope.currentPage++;
                    }
                };

                $scope.setPage = function () {
                    $scope.currentPage = this.n;
                };

                $scope.startAll = function () {
                    for (var machineid in $scope.checked) {
                        if ($scope.checked[machineid] === true) {
                            Machine.startMachine(machineid);
                            $scope.checked[machineid] = false;
                        }
                    }
                }

                $scope.stopAll = function () {
                    for (var machineid in $scope.checked) {
                        if ($scope.checked[machineid] === true) {
                            Machine.stopMachine(machineid);
                            $scope.checked[machineid] = false;
                        }
                    }
                }

                $scope.restartAll = function () {
                    for (var machineid in $scope.checked) {
                        if ($scope.checked[machineid] === true) {
                            Machine.rebootMachine(machineid);
                            $scope.checked[machineid] = false;
                        }
                    }
                }

                $scope.startMachine = function (id) {
                    confirm(localization.translate($scope, null, 'Are you sure you want to start the machine'), function () {
                        $$track.event('machine', 'start');
                        Machine.startMachine(id);
                    });
                };

                $scope.stopMachine = function (id) {
                    confirm(localization.translate($scope, null, 'Are you sure you want to stop the machine'), function () {
                        Machine.stopMachine(id);
                        $$track.event('machine', 'stop');
                    });
                };

                $scope.deleteMachine = function (id) {
                    confirm(localization.translate($scope, null, 'Are you sure you want to delete the machine'), function () {
                        $$track.event('machine', 'delete');
                        Machine.deleteMachine(id);
                    });
                };

                $scope.rebootMachine = function (id) {
                    confirm(localization.translate($scope, null, 'Are you sure you want to reboot the machine'), function() {
                        $$track.event('machine', 'reboot');
                        Machine.rebootMachine(id);
                    });
                };



                $scope.showGroupActions = function () {
                    $scope.ischecked = false;
                    for (var machineid in $scope.checked) {
                        if ($scope.checked[machineid] === true) {
                            $scope.ischecked = true;
                        }
                    }
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

                $scope.checkState = function(state) {
                    console.log(state);
                };

                $scope.isPrivateIP = function (ip) {
                    return util.isPrivateIP(ip);
                };

                if (!$scope.sortingOrder) {
                    $scope.reverse = false;
                    $scope.sortBy('created');
                }
            }

        ]);
}(window.angular, window.JP.getModule('Machine')));
