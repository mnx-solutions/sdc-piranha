'use strict';

(function (ng, app) {
	app.service('account', [ '$rootScope', '$resource', function ($rootScope, $resource) {
		var User = $resource('/account');
		var Key = $resource('/account/keys/:key');

		var user = User.get();

		return {
			getUser: function (callback) {
				return user ? (callback ? callback(user) : user) : User.get(callback);
			},

			updateUser: function (data) {
				this.getUser(function (user) {
					new User(ng.extend(user, data)).$save(function () {
						$rootScope.$broadcast('account:update');
					});
				});
			},

			getKeys: function (key) {
				return Key.query({ key: key });
			},

			createKey: function (data, callback) {
				if (!data.name) {
					callback(new Error('Key name is missing'));
					return;
				}

				if (!data.key) {
					callback(new Error('Key content is missing'));
					return;
				}

				new Key(data).$save(function () {
					$rootScope.$broadcast('account:update');
					callback();
				});
			}
		};
	}]);

}(window.angular, window.JP.getModule('Account')));