'use strict';

(function (app) {

    app.directive('accountSshCreate', [
        'localization',
        '$http',
        '$rootScope',
        'PopupDialog',
        '$sce',
        '$q',
        'Account',
        function (localization, $http, $rootScope, PopupDialog, $sce, $q, Account) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function ($scope) {
                    localization.bind('account', $scope);
                    $rootScope.downloadLink = null;
                },
                link: function ($scope) {
                    Account.assignSubUserId($scope);

                    var showKeyAddedMessage = function () {
                        var message = 'SSH key successfully added to your account.';
                        if ($scope.subUserId) {
                            message = 'SSH key successfully added to user\'s account. You will be prompted for private key download shortly. Please keep the private key safe.';
                        }
                        return $q.when(Account.showPopupDialog($scope, 'message', 'Message', message));
                    };

                    var showDownload = function () {
                        // if we are in signup, show the download right away
                        $scope.iframe = $sce.trustAsHtml('<iframe src="' + $rootScope.downloadLink + '"></iframe>');
                        $scope.iframePublicKey = $sce.trustAsHtml('<iframe src="' + $rootScope.downloadLink.replace('download', 'downloadPublic') + '"></iframe>');
                    };

                    var showMessageAndDownloadKeys = function () {
                        if ($scope.updateKeys) {
                            $scope.updateKeys(true, function (err) {
                                showDownload();
                                showKeyAddedMessage().then(function () {
                                    if (err) {
                                        PopupDialog.errorObj(err);
                                    }
                                });
                            });
                        } else {
                            showDownload();
                            if ($scope.nextStep) {
                                setTimeout(function () {
                                    $scope.passSsh('/main/#!/account/ssh');
                                }, 1000);
                            }
                            if ($scope.subUserId) {
                                showKeyAddedMessage();
                                $rootScope.$broadcast('sshCreated', true);
                            } else {
                                $rootScope.$broadcast('sshProgress', false);
                            }
                        }
                    };

                    var generateSshKeyModalCallback = function (result) {
                        if (result && result.generate) {
                            $http.post('account/ssh/create/', {name: result.keyName, subUser: $scope.subUserId})
                                .success(function (data) {
                                    var keyId = data.keyId;
                                    if (data.success) {
                                        // as this is directive, we need to use rootScope here
                                        $rootScope.$broadcast('sshProgress', false);
                                        $rootScope.downloadLink = 'account/ssh/download/' + keyId;
                                        $rootScope.sshKeyName = data.name;

                                        showMessageAndDownloadKeys();
                                    } else {
                                        // error
                                        $rootScope.$broadcast('sshProgress', false);
                                        Account.showPopupDialog($scope, 'error', 'Error', 'Unable to generate SSH key: ' + data.err.message + '.');
                                    }
                                });
                        } else {
                            $rootScope.$broadcast('sshProgress', false);
                        }
                    };

                    /* SSH Key generation popup */
                    $scope.generateSshKey = function () {
                        var sshKeyModalCtrl = function ($scope, dialog) {
                            if ($scope.subUserId) {
                                $scope.message = 'User\'s private key will begin downloading when you click "Create Key". The public half of the key will be added to user\'s account.';
                            }
                            $scope.keyName = '';

                            $scope.close = function (res) {
                                if (!res || !res.generate) {
                                    $rootScope.$broadcast('sshProgress', false);
                                }
                                dialog.close(res);
                            };

                            $scope.generateKey = function () {
                                $rootScope.$broadcast('sshProgress', true);
                                $scope.close({generate: true, keyName: $scope.keyName});
                            };
                        };

                        var opts = {
                            templateUrl: 'account/static/template/dialog/generate-ssh-modal.html',
                            openCtrl: sshKeyModalCtrl
                        };
                        PopupDialog.custom(opts, generateSshKeyModalCallback);
                    };
                },
                templateUrl: 'account/static/partials/account-ssh-create.html'
            };
}]);
}(window.JP.getModule('Account')));