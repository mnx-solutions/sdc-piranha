'use strict';

(function (ng, app) {
    app.controller(
        'MachinesController',
        [
            '$scope',
            '$filter',
            'requestContext',
            'Machines',
            'localization',

function ($scope, $filter, requestContext, Machines, localization) {
    localization.bind('machine', $scope);
    requestContext.setUpRenderContext('machine.index', $scope);
    // Sorting
    $scope.sortingOrder = 'created';
    $scope.reverse = true;
    $scope.sortIcon = {};

    // Pagination
    $scope.groupedMachines = [];
    $scope.itemsPerPage = 10;
    $scope.pagedMachines = [];
    $scope.maxPages = 5;
    $scope.currentPage = 0;
    $scope.machines = Machines.getMachines().machines;
    $scope.machineList = Machines.getMachines();

    $scope.$watch('machines', function () {
        $scope.search();
    }, true);

    // Searching
    $scope.searchOptions = {
        All: [
            'created', 'id', 'name',
            'type', 'dataset', 'ips',
            'memory', 'disk', 'metadata'
        ],
        Name: ['id', 'name'],
        Type: ['type'],
        Ip: ['ips'],
        Memory: ['memory']
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
    var _labelMachines = function(machines) {
        for(var machine in machines) {
            if(machines[machine].name) {
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
                        if (searchMatch(attr[child], $scope.query)) {
                            return true;
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

        if ($scope.sortingOrder === newSortingOrder) {
            $scope.reverse = !$scope.reverse;
        } else {
            $scope.reverse = false;
        }

        $scope.sortingOrder = newSortingOrder;
        $scope.search();
        $scope.sortIcon = {};

        if ($scope.reverse) {
            $scope.sortIcon[newSortingOrder] = 'down';
        } else {
            $scope.sortIcon[newSortingOrder] = 'up';
        }
    };

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
        $scope.machines.forEach(function(machine){
            if (machine.state = 'stopped'){
                Machines.startMachine(machine.id);
            }
        });
    }

    $scope.stopAll = function () {
        $scope.machines.forEach(function(machine){
            if (machine.state = 'started'){
                Machines.stopMachine(machine.id);
            }
        });
    }

}
        ]);
}(window.angular, window.JP.getModule('Machine')));
