'use strict';

(function(ng, app) {
	app.controller(
		'MachinesController',
		function($scope, requestContext, Machine) {
			var renderContext = requestContext.setUpRenderContext('machine.index', $scope);
			var machines = [];

			/**
			 * Sorting wrapper
			 */

			var sorter = {
				init: function(keys) {
					this._keys = [];
					this._key = null;
					this._data = {};
					this._direction = -1; // -1: desc, 1 asc
				},

				bindData: function(data) {
					this._data = data;
				},

				sortByKey: function(key, direction) {
					if (direction) {
						this._drection = direction;
					}

					if (this._key === key && !direction) {
						this._direction = -this._direction;
					}

					this._key = key;

					var self = this;
					this._data.sort(function(a, b) {
						if (a[key] > b[key]) {
							return self._direction;
						} if (a[key] < b[key]) {
							return -self._direction;
						}

						return 0;
					});
				},

				isKey: function(key) {
					return (this._key === key);
				},

				getDirection: function() {
					return (this._direction === 1 ? 'asc' : 'desc')
				}
			};

			/**
			 * Selection handling wrapper
			 */
			var selection = {
				STATE: { CHECKED: 0, UNCHECKED: 1, MODIFIED: 2 },

				init: function(state) {
					this._state = state || this.STATE.UNCHECKED;
					this._selections = [];
					this._data = {};
				},

				bindData: function(data) {
					this.init();
					this._data = data;
				},

				toggleAll: function() {
					if ((this._state === this.STATE.CHECKED)) {
						this._state =  this.STATE.UNCHECKED;
						this._selections = [];
					} else {
						var self = this;
						this._data.forEach(function(item, index) {
							self._selections.push(item.id);
						});

						this._state = this.STATE.CHECKED;
					}
				},

				toggleById: function(id) {
					if (this.isSelected(id)) {
						this._selections.splice(this._selections.indexOf(id), 1);
					} else {
						this._selections.push(id);
					}

					this._state = this.STATE.MODIFIED;
				},

				isSelected: function(id) {
					return this._selections.indexOf(id) !== -1;
				},

				mapSelections: function(callback) {
					var selections = [];

					this._selections.forEach(function(id, index) {
						selections.push(callback(id));
					});

					return selections;
				},

				getState: function() {
					return this._state;
				}
			};

			$scope.selection = selection;
			$scope.selection.init();

			$scope.sorter = sorter;
			$scope.sorter.init([ 'id', 'type', 'memory', 'created' ]);

			/**
			 * Controller methods
			 */
			$scope.selectAll = function() {
				selection.toggleAll();
			};

			$scope.selectMachine = function(uuid) {
				selection.toggleById(uuid);
			};

			$scope.sortMachinesByColumn = function(column) {
				sorter.sortByKey(column);
			};

			$scope.updateMachines = function() {
				machines = Machine.query();
				$scope.machines = machines;

				sorter.bindData(machines);
				selection.bindData(machines);
			};

			$scope.showSelections = function() {
				var selectedMachines = $scope.selection.mapSelections(function(id) {
					for (var i = 0, c = machines.length; i < c; i++) {
						var machine = machines[i];
						if (machine.id === id) {
							return machines[i];
						}
					}
				});

				console.log(selectedMachines);
			};

			$scope.updateMachines();
		}
	);
})(angular, JoyentPortal);