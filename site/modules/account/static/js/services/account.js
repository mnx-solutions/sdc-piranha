'use strict';

(function (ng, app) {
    app.service('account', ['$rootScope', '$resource',

function ($rootScope, $resource) {
    var User = $resource('/account');
    var Key = $resource('/account/keys/:key');

    var user = User.get();

    return {
        getUser: function (callback) {
            if (user) {
                return callback ? callback(user) : user;
            }
            return User.get(callback);
        },
        updateUser: function (data) {
            this.getUser(function (usr) {
                new User(ng.extend(usr, data)).$save(function () {
                    $rootScope.$broadcast('account:update');
                });
            });
        },
        getKeys: function (key) {
            return Key.query({key: key});
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
}

]);

}(window.angular, window.JP.getModule('Account')));