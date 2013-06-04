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

        function ($scope, $cookieStore, $filter, $$track, $dialog, $q, requestContext, Machine, Dataset, Package, localization, util) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.index', $scope, {
                title: localization.translate(null, 'machine', 'See my Joyent Instances')
            });

            $scope.listTypes = [ 'normal', 'alternate' ];
            $scope.listType = $scope.listTypes[0]; // Defaults to 'normal'

            // Sorting
            $scope.sortingOrder = null;
            $scope.reverse = true;
            $scope.sortIcon = {};

            $scope.sortable = [
                { title: 'Name', value: 'label' },
                { title: 'Datacenter', value: 'datacenter' },
                { title: 'Created', value: 'created' },
                { title: 'State', value: 'state' }
            ];
            $scope.sortField = $scope.sortable[2];

            $scope.loading = true;

            // Pagination
            $scope.groupedMachines = [];
            $scope.itemsPerPage = 15;
            $scope.pagedMachines = [];
            $scope.collapsedMachines = {};
            $scope.maxPages = 5;
            $scope.currentPage = 0;
            $scope.machines = Machine.machine();
            $scope.packages = Package.package();

            $q.all([
                    $q.when($scope.machines),
                    $q.when($scope.packages)
                ]).then(function () {
                    $scope.loading = false;
                });

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

            // Searching
            $scope.searchOptions = {
                All: [
                    'created', 'id', 'name',
                    'type', 'dataset', 'ips',
                    'memory', 'disk', 'metadata',
                    'datacenter'
                ],
                Visible: [
                    'created', 'id', 'name',
                    'ips', 'datacenter'
                ],
                Name: ['id', 'name'],
                Type: ['type'],
                Ip: ['ips'],
                Memory: ['memory'],
                Datacenter: ['datacenter']
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
            $scope.sortBy = function (fieldName) {
                // Assume that filter method will find least one matching item
                try {
                    $scope.sortField = $scope.sortable.filter(function (item) {
                        return fieldName === item.value;
                    })[0];

                    $cookieStore.put('sortField', fieldName);
                    $cookieStore.put('sortDirection', !$scope.reverse);
                } catch (e) {
                    // Cannot change sorting field, ignore
                    return;
                }

                var oldFieldName = $scope.sortingOrder;
                $scope.reverse = !$scope.reverse;
                $scope.sortingOrder = fieldName;
                $scope.search((oldFieldName != fieldName));


                $scope.sortIcon = {};
                if ($scope.reverse) {
                    $scope.sortIcon[fieldName] = 'down';
                } else {
                    $scope.sortIcon[fieldName] = 'up';
                }
            };

            $scope.loading = true;

            // Searching
            $scope.search = function (changePage) {
                // filter by search term
                var oldMachineCount = $scope.filteredMachines.length;
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

                // add first page
                ret.push(0);
                for (i = start; i < end; i++) {
                    // don't duplicate first or last page
                    if(i != 0 && i != $scope.pagedMachines.length-1)
                        ret.push(i);
                }

                // add last page
                if($scope.pagedMachines.length > 1)
                    ret.push($scope.pagedMachines.length-1);

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
                $scope.sortBy($cookieStore.get('sortField') || $scope.sortField.value);
            }

            // Retrieve selected list type from the cookie or use default fallback
            $scope.changeListType($cookieStore.get('listType') || $scope.listType);
        }

    ]);
}(window.angular, window.JP.getModule('Machine')));
