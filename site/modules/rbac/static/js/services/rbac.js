'use strict';

(function (app) {
    /**
     * @ngdoc service
     * @name rbac.service:rbac
     *
     * @requires angular.$q
     *
     * @description
     * RBAC module
     */
    app.factory('rbac.Service', [
        '$q',
        'serverTab',
        function ($q, serverTab) {
            var service = {};

            var action = function (actionName, ops) {
                //FIXME: Would be great to introduce caching for RBAC resources
                var deferred = $q.defer();

                var context = {
                    name: actionName,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                };
                if (ops) {
                    context.data = ops;
                }
                serverTab.call(context);
                return deferred.promise;
            };

            service.listUsers = function () {
                return action('listUsers');
            };

            service.getUser = function (userId) {
                return action('getUser', {id: userId});
            };

            service.updateUser = function (ops) {
                return action('updateUser', ops);
            };

            service.createUser = function (ops) {
                return action('createUser', ops);
            };

            service.deleteUser = function (userId) {
                return action('deleteUser', {id: userId});
            };

            service.changeUserPassword = function (userId, password, passwordConfirmation) {
                return action('changeUserPassword', {
                    id: userId,
                    password: password,
                    password_confirmation: passwordConfirmation
                });
            };

            service.createRole = function (ops) {
                return action('createRole', ops);
            };

            service.getRole = function (roleId) {
                return action('getRole', {id: roleId});
            };

            service.updateRole = function (ops) {
                return action('updateRole', ops);
            };

            service.deleteRole = function (roleId) {
                return action('deleteRole', {id: roleId});
            };

            service.listRoles = function () {
                return action('listRoles');
            };

            service.listPolicies = function () {
                return action('listPolicies');
            };

            service.getPolicy = function (policyId) {
                return action('getPolicy', {id: policyId});
            };

            service.deletePolicy = function (policyId) {
                return action('deletePolicy', {id: policyId});
            };

            service.createPolicy = function (ops) {
                return action('createPolicy', ops);
            };

            service.updatePolicy = function (ops) {
                return action('updatePolicy', ops);
            };

            return service;
        }]);
}(window.JP.getModule('rbac')));