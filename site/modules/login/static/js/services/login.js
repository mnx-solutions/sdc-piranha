'use strict';

(function (ng, app) {
	// I provide information about the current route request.
	app.factory('Login', ['$http', function ($http) {
		return {
			try: function (credentials, success) {
				$http.post('/login', credentials).success(success);
			}
		};
	}]);
}(window.angular, window.JP.getModule('Login')));
