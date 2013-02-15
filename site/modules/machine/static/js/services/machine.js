'use strict';

(function(ng, app) {
	app.factory('Machine', ['$resource', function ($resource) {
		return $resource('/machine', {}, {});
	}]);
})(angular, JoyentPortal);