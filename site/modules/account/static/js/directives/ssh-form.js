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
        function (Account, PopupDialog, localization, util, $rootScope, $q, RBAC) {
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
                    Account.assignSubUserId($scope).then(function () {
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
                    if ($scope.subUserId === 'create') {
                        $scope.subUserId = false;
                    }
                    var errorCallback = function (err, cb) {
                        $scope.loading = false;
                        $scope.loadingKeys = false;
                        if (angular.isFunction(cb)) {
                            cb(err);
                        } else {
                            PopupDialog.errorObj(err);
                        }
                        if ($scope.subUserId && err.message.indexOf('listuserkeys') === -1) {
                            getKeysList(null, true);
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

                    var getKeysList = function (cb, suppressErrors) {
                        RBAC.listUserKeys($scope.subUserId).then(function (list) {
                            $scope.keys = list;
                            $scope.loadingKeys = false;
                            if (angular.isFunction(cb)) {
                                cb();
                            }
                        }, function (err) {
                            if (!suppressErrors) {
                                errorCallback(err, cb);
                            }
                        });
                    };

                    $scope.updateKeys = function (notifyDataChanged, cb) {
                        if (typeof (notifyDataChanged) === 'function') {
                            cb = notifyDataChanged;
                            notifyDataChanged = false;
                        }
                        $scope.loadingKeys = true;
                        if ($scope.subUserId) {
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
                        Account.showPopupDialog($scope, 'message', 'Message', 'Key successfully deleted.');
                    };

                    $scope.deleteKey = function (name, fingerprint, $event) {
                        $event.stopPropagation();
                        if (name === fingerprint) {
                            name = $scope.getKeyName({name: name, fingerprint: fingerprint});
                        }
                        PopupDialog.confirm(null,
                            localization.translate($scope, null, 'Are you sure you want to delete "{{name}}" SSH key?', {name: name}),
                            function () {
                                $scope.loadingKeys = true;
                                $scope.keys = null;
                                if ($scope.subUserId) {
                                    RBAC.deleteUserKey($scope.subUserId, name, fingerprint).then(function () {
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
                },
                templateUrl: 'account/static/partials/ssh-form.html'
            };
        }]);
}(window.JP.getModule('Account')));