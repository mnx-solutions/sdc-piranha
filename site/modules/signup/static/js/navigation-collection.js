'use strict';

/**
 * Navigation collection class
 */
function NavigationCollection() {
	this._items = [];

	var self = this;
	Object.defineProperty(this, 'items', {
		get: function() {
			return self._items;
		}
	});

	Object.defineProperty(this, 'selectedItem', {
		get: function() {
			for (var i = 0, c = this._items.length; i < c; i++) {
				if (this._items[i].selected) {
					return this._items[i];
				}
			}

			return null;
		}
	});
}

NavigationCollection.prototype.item = function(index) {
	if (index >= 0 && (index <= this._items.length - 1)) {
		return this._items[index];
	} else {
		new Error('Out of bounds');
	}
};

NavigationCollection.prototype.push = function(item) {
	// Object compare
	if (this._items.indexOf(item) !== -1) {
		throw new Error('Navigation item already exist');
	}

	// Navigation item ID must be unique
	for (var i = 0, c = this._items.length; i < c; i++) {
		if (this._items[i].id === item.id) {
			throw new Error('Navigation item already exist');
		}
	}

	this._items.push(item);
};

NavigationCollection.prototype.pop = function(item) {
	this.popAtIndex(this._items.indexOf(item));
};

NavigationCollection.prototype.popAtIndex = function(index) {
	if (index >= 0 && (index <= this._items.length - 1)) {
		this._items.splice(index, 1);
	} else {
		new Error('Out of bounds');
	}
};

NavigationCollection.prototype.selectItemAtIndex = function(index) {
	if (index >= 0 && (index <= this._items.length - 1)) {
		for (var i = 0, c = this._items.length; i < c; i++) {
			console.log(this._items[i].state);
			if (this._items[i].state <= NavigationItem.STATE.COMPLETE) {
				return;
			}

			if (i == index) {
				this._items[i].selected = true;
			} else {
				this._items[i].selected = false;
			}
		}
	} else {
		new Error('Out of bounds');
	}
};

NavigationCollection.prototype.selectNextItem = function() {
	for (var i = 0, c = this._items.length; i < c; i++) {
		if (this._items[i].selected) {
			if (i < (c - 1)) {
				this._items[i].selected = false;
				this._items[i + 1].selected = true;
				return;
			}
		}
	}
};
