'use strict';

(function(ng, app) {
	app.factory('Machine', ['$resource', function ($resource) {
		return $resource('/machine', {}, {});
	}]);
})(window.angular, window.JoyentPortal);