'use strict';

(function (app) {
    app.factory('rbac.User', [
        'rbac.Service',
        'PopupDialog',
        'localization',
        function (rbac, PopupDialog, localization) {
            var service = {};

            var errorCallback = function (err) {
                if (err && err.message === 'passwordInHistory') {
                    err.message = 'Password was already used';
                }
                PopupDialog.errorObj(err);
            };

            service.changeUserPassword = function (uuid, scope, successMessage) {
                var opts = {
                    templateUrl: 'rbac/static/partials/change-password.html',
                    openCtrl: function ($scope, dialog) {
                        $scope.buttons = [
                            {
                                result: 'cancel',
                                label: 'Cancel',
                                cssClass: 'grey-new effect-orange-button',
                                setFocus: false
                            },
                            {
                                result: 'ok',
                                label: 'Change Password',
                                cssClass: 'orange',
                                setFocus: false
                            }
                        ];
                        $scope.buttonClick = function (passwords, res) {
                            if (res && res === 'ok') {
                                if (!$scope.passForm.$invalid) {
                                    dialog.close(passwords);
                                }
                                return;
                            }
                            dialog.close();
                        };
                    }
                };
                PopupDialog.custom(
                    opts,
                    function (passwords) {
                        scope.loading = !!passwords;
                        if (passwords) {
                            rbac.changeUserPassword(uuid, passwords[0], passwords[1]).then(function () {
                                scope.loading = false;
                                if (successMessage) {
                                    PopupDialog.message(
                                        localization.translate(
                                            scope,
                                            null,
                                            'Message'
                                        ),
                                        localization.translate(
                                            scope,
                                            null,
                                            successMessage
                                        )
                                    );
                                }
                            }, errorCallback);
                        }
                    }
                );
            };

            return service;
        }]);
}(window.JP.getModule('rbac')));