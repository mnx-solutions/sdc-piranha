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
        '$cacheFactory',
        function ($q, serverTab, $cacheFactory) {
            var ACCESS = {READ: 0, WRITE: 1};
            var ENTITY_TYPE = {USER: 'user', ROLE: 'role', POLICY: 'policy'};
            var CACHE_DEPENDENCIES = {policy: 'role', user: 'role'};

            var service = {};
            var promiseActions = {};
            var cache = $cacheFactory('cacheId');

            var updateCache = function (ops, data, entityType, access, isList) {
                if (!entityType) {
                    return;
                }
                if (ACCESS.WRITE === access) {
                    if (CACHE_DEPENDENCIES[entityType]) {
                        cache.remove(CACHE_DEPENDENCIES[entityType] + '_list');
                    }
                    cache.remove(entityType + '_list');
                    cache.remove(entityType + '_' + ops.id);
                } else if (isList) {
                    cache.put(entityType + '_list', data);
                } else {
                    cache.put(entityType + '_' + ops.id, data);
                }
            };

            var getCache = function (ops, entityType, access, isList) {
                if (!entityType || ACCESS.WRITE === access) {
                    return;
                }
                var cachedData;
                if (isList) {
                    cachedData = cache.get(entityType + '_list');
                } else {
                    cachedData = cache.get(entityType + '_' + ops.id);
                }
                return cachedData;
            };

            var action = function (actionName, ops, entityType, access, isList) {
                var deferred = $q.defer();

                var cachedData = getCache(ops, entityType, access, isList);
                if (cachedData) {
                    deferred.resolve(cachedData);
                    return deferred.promise;
                }
                var promiseKey = actionName + (ops && ops.id || '');
                if (!promiseActions[promiseKey] || !promiseActions[promiseKey].pending) {
                    promiseActions[promiseKey] = {};
                    promiseActions[promiseKey].deferred = deferred;
                    promiseActions[promiseKey].pending = true;
                } else {
                    promiseActions[actionName].deferred.promise.then(deferred.resolve, deferred.reject);
                    return deferred.promise;
                }

                var context = {
                    name: actionName,
                    done: function (err, job) {
                        promiseActions[promiseKey].pending = false;
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        updateCache(ops, data, entityType, access, isList);
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
                return action('listUsers', null, ENTITY_TYPE.USER, ACCESS.READ, true);
            };

            service.getUser = function (userId) {
                return action('getUser', {id: userId}, ENTITY_TYPE.USER, ACCESS.READ);
            };

            service.updateUser = function (ops) {
                return action('updateUser', ops, ENTITY_TYPE.USER, ACCESS.WRITE);
            };

            service.createUser = function (ops) {
                return action('createUser', ops, ENTITY_TYPE.USER, ACCESS.WRITE);
            };

            service.deleteUser = function (userId) {
                return action('deleteUser', {id: userId}, ENTITY_TYPE.USER, ACCESS.WRITE);
            };

            service.changeUserPassword = function (userId, password, passwordConfirmation) {
                return action('changeUserPassword', {
                    id: userId,
                    password: password,
                    password_confirmation: passwordConfirmation
                });
            };

            service.createRole = function (ops) {
                return action('createRole', ops, ENTITY_TYPE.ROLE, ACCESS.WRITE);
            };

            service.getRole = function (roleId) {
                return action('getRole', {id: roleId}, ENTITY_TYPE.ROLE, ACCESS.READ);
            };

            service.updateRole = function (ops) {
                return action('updateRole', ops, ENTITY_TYPE.ROLE, ACCESS.WRITE);
            };

            service.deleteRole = function (roleId) {
                return action('deleteRole', {id: roleId}, ENTITY_TYPE.ROLE, ACCESS.WRITE);
            };

            service.listRoles = function () {
                return action('listRoles', null, ENTITY_TYPE.ROLE, ACCESS.READ, true);
            };

            service.listPolicies = function () {
                return action('listPolicies', null, ENTITY_TYPE.POLICY, ACCESS.READ, true);
            };

            service.getPolicy = function (policyId) {
                return action('getPolicy', {id: policyId}, ENTITY_TYPE.POLICY, ACCESS.READ);
            };

            service.deletePolicy = function (policyId) {
                return action('deletePolicy', {id: policyId}, ENTITY_TYPE.POLICY, ACCESS.WRITE);
            };

            service.createPolicy = function (ops) {
                return action('createPolicy', ops, ENTITY_TYPE.POLICY, ACCESS.WRITE);
            };

            service.updatePolicy = function (ops) {
                return action('updatePolicy', ops, ENTITY_TYPE.POLICY, ACCESS.WRITE);
            };

            return service;
        }]);
}(window.JP.getModule('rbac')));