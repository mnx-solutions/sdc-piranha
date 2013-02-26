'use strict';

(function(ng, app) {
	app.service('account', [ '$rootScope', '$resource' , function($rootScope, $resource) {
		var User = $resource('/account');
		var Key = $resource('/account/keys/:key');

		return {
			getUser: function(callback) {
				return User.get(callback);
			},

			updateUser: function(data) {
				this.getUser(function(user) {
					new User(ng.extend(user, data)).$save(function() {
						$rootScope.$broadcast('account.onUpdate');
					});
				});
			},

			getKeys: function(key) {
				return Key.query({ key: key });
			},

			createKey: function(data) {
				if (!data.name) {
					throw new Error('Key name is missing');
				}

				if (!data.key) {
					throw new Error('Key content is missing');
				}

				new Key(data).$save(function() {
					$rootScope.$broadcast('account.onUpdate');
				});
			}
		};
	}]);

})(window.angular, window.JoyentPortal);