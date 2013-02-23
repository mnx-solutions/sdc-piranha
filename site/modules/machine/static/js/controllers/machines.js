'use strict';

(function(ng, app) {
	app.controller(
		'MachinesController',
		function($scope, $filter, requestContext, Machine) {
			var renderContext = requestContext.setUpRenderContext('machine.index', $scope);

			$scope.sortingOrder = 'created';
			$scope.reverse = false;
			$scope.filteredMachines = [];
			$scope.groupedMachines = [];
			$scope.itemsPerPage = 4;
			$scope.pagedMachines = [];
			$scope.currentPage = 0;
			$scope.machines = Machine.query(function(){
				$scope.search();
			});

			var searchMatch = function (haystack, needle) {
					if (!needle) {
							return true;
					}
					return haystack.toLowerCase().indexOf(needle.toLowerCase()) !== -1;
			};

			// TODO: write a better search function
			// function to search machines
			$scope.search = function () {
					// filter by search term
					$scope.filteredMachines = $filter('filter')($scope.machines, function (item) {

							if (searchMatch(JSON.stringify(item), $scope.query))
								return true;

							return false;
					});
					// take care of the sorting order
					if ($scope.sortingOrder !== '') {
							$scope.filteredMachines = $filter('orderBy')($scope.filteredMachines, $scope.sortingOrder, $scope.reverse);
					}
					$scope.currentPage = 0;
					// now group by pages
					$scope.groupToPages();
			};

			// calculate page in place
			$scope.groupToPages = function () {
					$scope.pagedMachines = [];

					for (var i = 0; i < $scope.filteredMachines.length; i++) {
							if (i % $scope.itemsPerPage === 0) {
									$scope.pagedMachines[Math.floor(i / $scope.itemsPerPage)] = [ $scope.filteredMachines[i] ];
							} else {
									$scope.pagedMachines[Math.floor(i / $scope.itemsPerPage)].push($scope.filteredMachines[i]);
							}
					}
			};

			$scope.range = function (start, end) {
					var ret = [];
					if (!end) {
							end = start;
							start = 0;
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

			// change sorting order
			$scope.sort_by = function(newSortingOrder) {

					if ($scope.sortingOrder == newSortingOrder)
						$scope.reverse = !$scope.reverse;
					else
						$scope.reverse = false;

					$scope.sortingOrder = newSortingOrder;
					$scope.search();

					// icon setup
					$('.icon-arrow').each(function(){
							// icon reset
							$(this).removeClass('icon-arrow-up');
							$(this).removeClass('icon-arrow-down');
					});
					if ($scope.reverse)
						$('.title.machines-' + newSortingOrder +' i.icon-arrow').removeClass().addClass('icon-arrow icon-arrow-down');
					else
						$('.title.machines-' + newSortingOrder +' i.icon-arrow').removeClass().addClass('icon-arrow icon-arrow-up');
			};
		}
	);
})(window.angular, window.JoyentPortal);