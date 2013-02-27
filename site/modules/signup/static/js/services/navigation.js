'use strict';

(function (ng, app) {

	/**
	 * Navigation item
	 *
	 * Input object properties:
	 * id: Navigation id
	 * name: Navigation name
	 * partial: Navigation template
	 *
	 * @param {Object} obj Navigation item properties
	 */
	function NavigationItem(obj) {
		this._id = obj.id || null;
		this._name = obj.name || null;
		this._partial = obj.partial || null;
		this._selected = false;
		this._state = NavigationItem.STATE.INCOMPLETE;

		if (!this._id) {
			throw new Error('Navigation item ' +
				                'identifier is missing');
		}

		if (!this._name) {
			throw new Error('Navigation item name is missing');
		}

		if (!this._partial) {
			throw new Error('Navigation item partial' +
				                ' is missing');
		}

		var self = this;

		Object.defineProperty(this, 'id', {
			get: function () { return self._id; }
		});

		Object.defineProperty(this, 'name', {
			get: function () { return self._name; }
		});

		Object.defineProperty(this, 'partial', {
			get: function () { return self._partial; }
		});

		Object.defineProperty(this, 'selected', {
			get: function () {
				return self._selected;
			},

			set: function (selected) {
				self._selected = selected || false;
			}
		});

		Object.defineProperty(this, 'state', {
			get: function () {
				return self._state;
			},

			set: function (state) {
				var keys = Object.keys(NavigationItem.STATE);
				var i, c;
				for (i = 0, c = keys.length; i < c; i++) {
					if (NavigationItem.STATE[keys[i]] === state) {
						self._state = state;
						return;
					}
				}
			}
		});
	}

	NavigationItem.STATE = {
		INCOMPLETE: 0,
		INPROGRESS: 1,
		COMPLETE: 2,
		LOCKED: 3
	};


	/**
	 * Navigation collection class
	 */
	function NavigationCollection() {
		this._items = [];

		var self = this;
		Object.defineProperty(this, 'items', {
			get: function () {
				return self._items;
			}
		});

		Object.defineProperty(this, 'selectedItem', {
			get: function () {
				var i, c;
				for (i = 0, c = this._items.length; i < c; i++) {
					if (self._items[i].selected) {
						return self._items[i];
					}
				}

				return null;
			}
		});

		Object.defineProperty(this, 'STATES', {
			get: function () {
				return NavigationItem.STATE;
			}
		});
	}

	NavigationCollection.prototype.add = function (obj) {
		return this.push(this.createItem(obj));
	};

	NavigationCollection.prototype.createItem = function (obj) {
		return new NavigationItem(obj);
	};

	NavigationCollection.prototype.item = function (index) {
		if (index >= 0 && (index <= this._items.length - 1)) {
			return this._items[index];
		}

		throw new Error('Out of bounds');
	};

	NavigationCollection.prototype.push = function (item) {
		// Object compare
		if (this._items.indexOf(item) !== -1) {
			throw new Error('Navigation item already exist');
		}

		// Navigation item ID must be unique
		var i, c;
		for (i = 0, c = this._items.length; i < c; i++) {
			if (this._items[i].id === item.id) {
				throw new Error('Navigation item already exist');
			}
		}

		this._items.push(item);
	};

	NavigationCollection.prototype.pop = function (item) {
		this.popAtIndex(this._items.indexOf(item));
	};

	NavigationCollection.prototype.popAtIndex = function (index) {
		if (index >= 0 && (index <= this._items.length - 1)) {
			this._items.splice(index, 1);
		}

		throw new Error('Out of bounds');
	};

	NavigationCollection.prototype.selectItemAtIndex = function (index) {
		if (index >= 0 && (index <= this._items.length - 1)) {
			var i, c;
			for (i = 0, c = this._items.length; i < c; i++) {
				console.log(this._items[i].state);
				if (this._items[i].state <= NavigationItem.STATE.COMPLETE) {
					return;
				}

				this._items[i].selected = (i === index);
			}
		}

		throw new Error('Out of bounds');
	};

	NavigationCollection.prototype.selectNextItem = function () {
		var i, c;
		for (i = 0, c = this._items.length; i < c; i++) {
			if (this._items[i].selected) {
				if (i < (c - 1)) {
					this._items[i].selected = false;
					this._items[i + 1].selected = true;
					return;
				}
			}
		}
	};

	app.factory('navigation', function () {
		return new NavigationCollection();
	});
}(window.angular, window.JP.getModule('Signup')));