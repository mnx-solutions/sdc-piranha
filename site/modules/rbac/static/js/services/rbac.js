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

            service.listUsers = function () {
                var deferred = $q.defer();

                serverTab.call({
                    name: 'listUsers',
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var users = job.__read();
                        deferred.resolve(users);
                    }
                });

                return deferred.promise;

            };

            service.getUser = function (id) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'getUser',
                    data: {
                        id: id
                    },
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var user = job.__read();
                        deferred.resolve(user);
                    }
                });

                return deferred.promise;

            };

            service.updateUser = function (ops) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'updateUser',
                    data: ops,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.createUser = function (ops) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'createUser',
                    data: ops,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.deleteUser = function (id) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'deleteUser',
                    data: {
                        id: id
                    },
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.changeUserPassword = function (id, password, passwordConfirmation) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'changeUserPassword',
                    data: {
                        id: id,
                        password: password,
                        password_confirmation: passwordConfirmation
                    },
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.createRole = function (ops) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'createRole',
                    data: ops,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };
            service.getRole = function (id) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'getRole',
                    data: {id: id},
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.updateRole = function (ops) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'updateRole',
                    data: ops,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.deleteRole = function (id) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'deleteRole',
                    data: {id: id},
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.listRoles = function () {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'listRoles',
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var roles = job.__read();
                        deferred.resolve(roles);
                    }
                });

                return deferred.promise;

            };

            service.listPolicies = function () {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'listPolicies',
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var roles = job.__read();
                        deferred.resolve(roles);
                    }
                });

                return deferred.promise;
            };

            service.getPolicy = function (id) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'getPolicy',
                    data: {id: id},
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.deletePolicy = function (id) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'deletePolicy',
                    data: {id: id},
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.createPolicy = function (ops) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'createPolicy',
                    data: ops,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            service.updatePolicy = function (ops) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'updatePolicy',
                    data: ops,
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        var data = job.__read();
                        deferred.resolve(data);
                    }
                });
                return deferred.promise;
            };

            return service;
        }]);
}(window.JP.getModule('rbac')));