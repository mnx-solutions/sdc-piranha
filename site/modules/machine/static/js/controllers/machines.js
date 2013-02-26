'use strict';

(function(ng, app) {
	app.controller(
		'MachinesController',
		function($scope, $filter, requestContext, $timeout, account, Machines, $rootScope) {
			var renderContext = requestContext.setUpRenderContext('machine.index', $scope);

			/*
			$scope.account = account.getUser();
			$scope.keys = account.getKeys();

			$scope.$on('account.onUpdate', function() {
				console.log('update');
			});

			account.createKey({
				name: 'random2',
				key: 'ssh-dss AAAAB3NzaC1kc3MAAACBAK/5+Ix1K57IWTekTt/9xdCkcE2fooFJPixf0vSg+NkQ5pgaTk5ELdWV4OGN7rBNHOpnGqsWWu76/7XEjWtFt1yq8IO0QZwFEtBFs9fNXtaBWZK3qjOcCEHJQzKnh1//DOMML+/v2nLdyleOytzTVFavu42xTcKD3vImQOzAQpnlAAAAFQCpv4Rp2eWj9gxZumYgn0Y3xPYB3QAAAIEAlnckiRNuYgUelbCAKulh9UNQCTdXGv6gf33WOw1+TpydHJO6vFWFFnsOvACmVPaOXl+RagtCuY9XrHwr+0r/7Nt3AZ9wrvu9noGjt6YCVTl83TQfkylBfv9rqJJGpp9+wVEfZC17aKcu1lqelsr7Bhv8JukZiuPs6ATZxTa+IgAAAACBAI0MbhcaGy/H9ODHT92ScwTBzIs2DsjjPgrew2oCeKMVsvK4r5goKQyGBVzipCR72Fq2fpyAc3FA5fxdN6HQGMZSmwFf34xvMldEb4ho8Lg8HdXFADGTX2lfzjMd6jwkJFutgfxnPYUIUkn4hEe8msdW84a17Kk9S4cG9MMQf98o user@localhost'
			});

			$timeout(function() {
				account.updateUser();
			}, 2000);
*/

			$scope.sortingOrder = 'created';
			$scope.reverse = false;
			$scope.filteredMachines = [];
			$scope.groupedMachines = [];
			$scope.itemsPerPage = 4;
			$scope.pagedMachines = [];
			$scope.currentPage = 0;
            $scope.machines = Machines.getMachines();

            $scope.$watch("machines", function(){
                $scope.search();
            }, true);

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
