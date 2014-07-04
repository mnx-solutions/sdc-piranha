'use strict';

(function (app) {

    app.directive('accountSshCreate', [
        'localization',
        '$http',
        '$rootScope',
        'PopupDialog',
        '$sce',
        function (localization, $http, $rootScope, PopupDialog, $sce) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function ($scope) {
                    localization.bind('account', $scope);

                    $rootScope.downloadLink = null;
                },
                link: function ($scope) {
                    var subUser = false;
                    /* SSH Key generation popup */
                    $scope.generateSshKey = function () {
                        if ($scope.user && $scope.user.id) {
                            subUser = $scope.user.id;
                            $rootScope.$broadcast('sshCreating', true);
                        }
                        var sshKeyModalCtrl = function ($scope, dialog) {
                            if (subUser) {
                                $scope.message = 'User\'s private key will begin downloading when you click "Create Key". The public half of the key will be added to user\'s Joyent Cloud account. Keep private key file safe.\' and \'SSH key successfully added to user\'s account. You will be prompted for private key download shortly.';
                            }
                            $scope.keyName = '';

                            $scope.close = function (res) {
                                if (!res || !res.generate) {
                                    $rootScope.loading = false;
                                }
                                dialog.close(res);
                            };

                            $scope.generateKey = function () {
                                $rootScope.loading = true;
                                $scope.close({generate: true, keyName: $scope.keyName});
                            };
                        };

                        var opts = {
                            templateUrl: 'account/static/template/dialog/generate-ssh-modal.html',
                            openCtrl: sshKeyModalCtrl
                        };
                        $rootScope.loading = true;
                        PopupDialog.custom(
                            opts,
                            function (data) {
                                if (data && data.generate === true) {
                                    var createUrl = 'account/ssh/create/';
                                    $http.post(createUrl, {name: data.keyName, subUser: subUser})
                                        .success(function (data) {

                                            var keyId = data.keyId;
                                            if (data.success === true) {

                                                var downloadLink = 'account/ssh/download/' + keyId;
                                                // as this is directive, we need to use rootScope here
                                                $rootScope.loading = false;
                                                $rootScope.downloadLink = downloadLink;
                                                $rootScope.sshKeyName = data.name;

                                                var keyAdded = function () {
                                                    PopupDialog.message(
                                                        localization.translate(
                                                            $scope,
                                                            null,
                                                            'Message'
                                                        ),
                                                        localization.translate(
                                                            $scope,
                                                            null,
                                                            'SSH key successfully added to your account.'
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
                                                    if (subUser) {
                                                        keyAdded();
                                                        $rootScope.$broadcast('sshCreated', true);
                                                    }
                                                }
                                            } else {
                                                // error
                                                $rootScope.loading = false;
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
                                                    function () {}
                                                );
                                            }
                                        });

                                } else {
                                    $rootScope.loading = false;
                                    if (subUser) {
                                        $rootScope.$broadcast('sshCancel', true);
                                    }
                                }
                            }
                        );
                    };
                },
                templateUrl: 'account/static/partials/account-ssh-create.html'
            };
}]);
}(window.JP.getModule('Account')));