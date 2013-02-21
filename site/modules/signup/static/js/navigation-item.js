'use strict';

/**
 * Navigation item
 *
 * Input object properties:
 * 	id: Navigation id
 * 	name: Navigation name
 * 	partial: Navigation template
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
		get: function() { return self._id; } }
	);

	Object.defineProperty(this, 'name', {
		get: function() { return self._name; } }
	);

	Object.defineProperty(this, 'partial', {
		get: function() { return self._partial; } }
	);

	Object.defineProperty(this, 'selected', {
		get: function() {
			return self._selected;
		},

		set: function(selected) {
			this._selected = selected || false;
		}
	});

	Object.defineProperty(this, 'state', {
		get: function() {
			return self._state;
		},

		set: function(state) {
			var keys = Object.keys(NavigationItem.STATE);
			for (var i = 0, c = keys.length; i < c; i++) {
				if (NavigationItem.STATE[keys[i]] === state) {
					this._state = state;
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
