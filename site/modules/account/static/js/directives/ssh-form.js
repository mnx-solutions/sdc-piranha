'use strict';

(function (app) {

    app.directive('sshForm', [
        'Account',
        'PopupDialog',
        'localization',
        'util',
        '$rootScope',
        '$q',
        'rbac.Service',
        'requestContext',
        function (Account, PopupDialog, localization, util, $rootScope, $q, RBAC, requestContext) {
            return {
                restrict: 'A',
                replace: true,
                scope: {
                    singleKey: '@',
                    noKeysMessage: '@',
                    isSubUserForm: '=?',
                    loadDisabled: '=?',
                    createInstanceFn: '&'
                },
                controller: function ($scope) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.keys = [];
                    $scope.isCreateKeyEnabled = true;
                    var subuserId = !$scope.isSubUserForm ? requestContext.getParam('id') : false;
                    if (subuserId === 'create') {
                        subuserId = false;
                    }
                    var errorCallback = function (err, cb) {
                        $scope.loading = false;
                        $scope.loadingKeys = false;
                        if (angular.isFunction(cb)) {
                            cb(err);
                        } else {
                            PopupDialog.errorObj(err);
                        }
                        if (subuserId && err.message.indexOf('listuserkeys') === -1) {
                            getKeysList();
                        }
                    };

                    $scope.$watch('singleKey', function () {
                        $scope.singleKey = util.parseBoolean($scope.singleKey);
                    });

                    $scope.getKeyName = function (key) {
                        if (key.name === key.fingerprint) {
                            return key.name.split(':').splice(-5).join('');
                        }
                        return key.name || '';
                    };

                    var getKeysList = function (cb) {
                        RBAC.listUserKeys(subuserId).then(function (list) {
                            $scope.keys = list;
                            $scope.loadingKeys = false;
                            if (angular.isFunction(cb)) {
                                cb();
                            }
                        }, function (err) {
                            errorCallback(err, cb);
                        });
                    };

                    $scope.updateKeys = function (notifyDataChanged, cb) {
                        if (typeof (notifyDataChanged) === 'function') {
                            cb = notifyDataChanged;
                            notifyDataChanged = false;
                        }
                        $scope.loadingKeys = true;
                        if (subuserId) {
                            getKeysList(cb);
                        } else {
                            $q.when(Account.getKeys(true)).then(function (result) {
                                if (notifyDataChanged) {
                                    $rootScope.$broadcast("ssh-form:onKeyUpdated", result);
                                }
                                $scope.keys = result;

                                if ($scope.singleKey) {
                                    $scope.isCreateKeyEnabled = result.length === 0;
                                }
                                $scope.loadingKeys = false;

                                if (typeof (cb) === 'function') {
                                    cb();
                                }
                            }, function (err) {
                                $scope.loadingKeys = false;
                                if (angular.isFunction(cb)) {
                                    cb(err);
                                } else {
                                    PopupDialog.errorObj(err);
                                }
                            });
                        }
                    };

                    var keyDeletedMessage = function () {
                        PopupDialog.message(
                            localization.translate(
                                $scope,
                                null,
                                'Message'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                'Key successfully deleted.'
                            )
                        );
                    };

                    $scope.deleteKey = function (name, fingerprint, $event) {
                        $event.stopPropagation();
                        PopupDialog.confirm(null,
                            localization.translate($scope, null, 'Are you sure you want to delete "{{name}}" SSH key?', {name: name}),
                            function () {
                                $scope.loadingKeys = true;
                                $scope.keys = null;
                                if (subuserId) {
                                    RBAC.deleteUserKey(subuserId, name, fingerprint).then(function () {
                                        getKeysList();
                                        keyDeletedMessage();
                                    }, errorCallback);
                                } else {
                                    var deleteKey = Account.deleteKey(fingerprint);
                                    $q.when(deleteKey, function () {
                                        $rootScope.$broadcast("ssh-form:onKeyDeleted");
                                        $scope.updateKeys(true, function () {
                                            if ($rootScope.downloadLink && $rootScope.downloadLink.indexOf(fingerprint) !== -1) {
                                                $rootScope.downloadLink = null;
                                            }
                                            keyDeletedMessage();
                                        });
                                    });
                                }
                            });
                    };

                    $scope.$on('sshProgress', function (event, isInProgress) {
                        $scope.loadingKeys = isInProgress;
                    });

                    $scope.$on('sshCreated', function () {
                        getKeysList();
                    });

                    Account.getAccount().then(function (account) {
                        $scope.account = account;
                        if ($scope.isSubUserForm && $scope.account.isSubuser) {
                            subuserId = $scope.account.id;
                        }

                        if (!$scope.loadDisabled) {
                            $scope.updateKeys();
                        } else {
                            $scope.$watch('loadDisabled', function (value) {
                                if (!value) {
                                    $scope.updateKeys();
                                }
                            });
                        }
                    });
                },
                templateUrl: 'account/static/partials/ssh-form.html'
            };
        }]);
}(window.JP.getModule('Account')));