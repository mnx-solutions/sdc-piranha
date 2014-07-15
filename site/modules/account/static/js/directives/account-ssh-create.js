'use strict';

(function (app) {

    app.directive('accountSshCreate', [
        'localization',
        '$http',
        '$rootScope',
        'PopupDialog',
        '$sce',
        'requestContext',
        'Account',
        function (localization, $http, $rootScope, PopupDialog, $sce, requestContext, Account) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function ($scope) {
                    localization.bind('account', $scope);
                    $rootScope.downloadLink = null;
                },
                link: function ($scope) {
                    var subUserId = !$scope.isSubUserForm ? requestContext.getParam('id') : false;
                    Account.getAccount().then(function (account) {
                        if ($scope.isSubUserForm && account.isSubuser) {
                            subUserId = account.id;
                        }
                    });

                    /* SSH Key generation popup */
                    $scope.generateSshKey = function () {
                        $rootScope.$broadcast('sshProgress', true);
                        var sshKeyModalCtrl = function ($scope, dialog) {
                            if (subUserId) {
                                $scope.message = 'User\'s private key will begin downloading when you click "Create Key". The public half of the key will be added to user\'s Joyent Cloud account.';
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
                        $rootScope.$broadcast('sshProgress', true);
                        PopupDialog.custom(
                            opts,
                            function (data) {
                                if (data && data.generate === true) {
                                    var createUrl = 'account/ssh/create/';
                                    $http.post(createUrl, {name: data.keyName, subUser: subUserId})
                                        .success(function (data) {
                                            var keyId = data.keyId;
                                            if (data.success === true) {

                                                var downloadLink = 'account/ssh/download/' + keyId;
                                                // as this is directive, we need to use rootScope here
                                                $rootScope.$broadcast('sshProgress', false);
                                                $rootScope.downloadLink = downloadLink;
                                                $rootScope.sshKeyName = data.name;

                                                var keyAdded = function () {
                                                    var message = 'SSH key successfully added to your account.';

                                                    if (subUserId) {
                                                        message = 'SSH key successfully added to user\'s account. You will be prompted for private key download shortly. Please keep the private key safe.';
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
                                                            message
                                                        )
                                                    );
                                                };

                                                if ($scope.updateKeys) {
                                                    $scope.updateKeys(true, function () {
                                                        // if we are in signup, show the download right away
                                                        $scope.iframe = $sce.trustAsHtml('<iframe src="' + downloadLink + '"></iframe>');
                                                        keyAdded();

                                                    });
                                                } else {
                                                    // if we are in signup, show the download right away
                                                    $scope.iframe = $sce.trustAsHtml('<iframe src="' + downloadLink + '"></iframe>');
                                                    if ($scope.nextStep) {
                                                        setTimeout(function () {
                                                            $scope.passSsh('/main/#!/account/ssh');
                                                        }, 1000);
                                                    }
                                                    if (subUserId) {
                                                        keyAdded();
                                                        $rootScope.$broadcast('sshCreated', true);
                                                    } else {
                                                        $rootScope.$broadcast('sshProgress', false);
                                                    }
                                                }
                                            } else {
                                                // error
                                                $rootScope.$broadcast('sshProgress', false);
                                                PopupDialog.error(
                                                    localization.translate(
                                                        $scope,
                                                        null,
                                                        'Error'
                                                    ),
                                                    localization.translate(
                                                        $scope,
                                                        null,
                                                        'Unable to generate SSH key: {{message}}.',
                                                        {
                                                            message: data.err.message
                                                        }
                                                    ),
                                                    function () {
                                                    }
                                                );
                                            }
                                        });

                                } else {
                                    $rootScope.$broadcast('sshProgress', false);
                                }
                            }
                        );
                    };
                },
                templateUrl: 'account/static/partials/account-ssh-create.html'
            };
}]);
}(window.JP.getModule('Account')));