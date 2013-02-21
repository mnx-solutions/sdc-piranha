'use strict';

(function(ng, app) {
	app.factory('navigation', function() {
		return new NavigationCollection();
	});
})(angular, JoyentPortal);