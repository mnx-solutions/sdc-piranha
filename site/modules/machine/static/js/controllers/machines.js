'use strict';

(function (ng, app) {
	app.controller(
	'MachinesController',

function ($scope, $filter, requestContext, Machines) {
	requestContext.setUpRenderContext('machine.index', $scope);

	// Sorting
	$scope.sortingOrder = 'created';
	$scope.reverse = false;
	$scope.sortIcon = {};

	// Pagination
	$scope.groupedMachines = [];
	$scope.itemsPerPage = 4;
	$scope.pagedMachines = [];
	$scope.maxPages = 5;
	$scope.currentPage = 0;
	$scope.machines = Machines.getMachines();
	$scope.$watch("machines", function(){
			$scope.search();
	}, true);

	// Searching
	$scope.searchOptions = {
		All:[
			'created', 'id', 'name',
			'type', 'dataset', 'ips',
			'memory', 'disk', 'metadata'
		],
		Name:[ 'id', 'name' ],
		Type:[ 'type' ],
		Ip:[ 'ips' ],
		Memory:[ 'memory' ]
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

	var _filter = function (subject) {
		var ret = $filter('filter')(subject, function (item) {

			for (var attrKey in item) {
				var attr = item[attrKey];
				if ($scope.searchable.indexOf(attrKey) === -1)
					continue;

				// handle up to 2 dimensional searching
				if (ng.isObject(attr) || ng.isArray(attr)) {
					for (var child in attr) {

						if (searchMatch(attr[child], $scope.query))
							return true;
					}

				} else if (ng.isString(attr) || ng.isNumber(attr)) {
					if (searchMatch(attr, $scope.query))
						return true;
				}
			}

			return (false);
		});
		return (ret);
	};

	// Controller methods
	// Sorting
	// change sorting order
	$scope.sortBy = function (newSortingOrder) {

		if ($scope.sortingOrder === newSortingOrder)
			$scope.reverse = !$scope.reverse;
		else
			$scope.reverse = false;

		$scope.sortingOrder = newSortingOrder;
		$scope.search();
		$scope.sortIcon = {};

		if ($scope.reverse)
			$scope.sortIcon[newSortingOrder] = 'down';
		else
			$scope.sortIcon[newSortingOrder] = 'up';

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
					$scope.reverse
				);
		}
		$scope.currentPage = 0;
		$scope.groupToPages();
	};

	// Pagination
	// calculate page in place
	$scope.groupToPages = function () {
		$scope.pagedMachines = [];

		for (var i = 0; i < $scope.filteredMachines.length; i++) {
			var index = Math.floor(i / $scope.itemsPerPage);
			if (i % $scope.itemsPerPage === 0) {
				$scope.pagedMachines[index] = [ $scope.filteredMachines[i] ];
			} else {
				$scope.pagedMachines[index].push($scope.filteredMachines[i]);
			}
		}
	};

	// get pagination range
	$scope.range = function () {
			var ret = [];

			var start = $scope.currentPage - Math.floor($scope.maxPages/2);
			var end = $scope.currentPage + Math.ceil($scope.maxPages/2);

			if (end > $scope.pagedMachines.length) {
				end = $scope.pagedMachines.length;
				if(end - $scope.maxPages >= 0) {
					start = end - $scope.maxPages;
				}
			}
			if (start < 0) {
				start = 0;
				if( start + $scope.maxPages <= $scope.pagedMachines.length) {
					end = start + $scope.maxPages;
				}
			}

			for (var i = start; i < end; i++) {
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

}

	);
})(window.angular, window.JoyentPortal);
