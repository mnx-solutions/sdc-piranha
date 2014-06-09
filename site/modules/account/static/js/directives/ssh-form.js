'use strict';

(function (app) {

    app.directive('sshForm', [
        'Account',
        'PopupDialog',
        'localization',
        'util',
        '$rootScope',
        '$q',
        function (Account, PopupDialog,localization, util, $rootScope, $q) {
            return {
                restrict: 'A',
                replace: true,
                scope: {
                    singleKey: '@',
                    noKeysMessage: '@',
                    createInstanceFn: '&'
                },
                controller: function($scope) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.keys = [];
                    $scope.isCreateKeyEnabled = true;

                    $scope.$watch('singleKey', function(data) {
                        $scope.singleKey = util.parseBoolean($scope.singleKey);
                    });

                    $scope.getKeyName = function (key) {
                        if (key.name === key.fingerprint) {
                            return key.name.split(':').splice(-5).join('');
                        }
                        return key.name || '';
                    };

                    $scope.updateKeys = function (notifyDataChanged, cb) {
                        if (typeof (notifyDataChanged) === 'function') {
                            cb = notifyDataChanged;
                            notifyDataChanged = false;
                        }
                        $scope.loadingKeys = true;

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
                        });
                    };

                    $scope.deleteKey = function (name, fingerprint, $event) {
                        $event.stopPropagation();
                        PopupDialog.confirm(null,
                            localization.translate($scope, null, 'Are you sure you want to delete "{{name}}" SSH key?', {name: name}),
                            function () {
                                $scope.loadingKeys = true;
                                $scope.keys = null;
                                var deleteKey = Account.deleteKey(fingerprint);

                                $q.when(deleteKey, function () {
                                    $rootScope.$broadcast("ssh-form:onKeyDeleted");
                                    $scope.updateKeys(true, function () {
                                        if ($rootScope.downloadLink && $rootScope.downloadLink.indexOf(fingerprint) !== -1) {
                                            $rootScope.downloadLink = null;
                                        }

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
                                            ),
                                            function () {}
                                        );
                                    });
                                });
                            });
                    };

                    $scope.updateKeys();

                },
                templateUrl: 'account/static/partials/ssh-form.html'
            };
        }]);
}(window.JP.getModule('Account')));