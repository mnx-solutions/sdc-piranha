'use strict';

(function (app) {

    app.directive('accountSshCreate', [
        'Account',
        'localization',
        'notification',
        '$q',
        '$window',
        '$dialog',
        '$timeout',
        '$http',
        function (Account, localization, notification, $q, $window, $dialog, $timeout, $http) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);

                    $scope.loading = false;

                },

                link: function ($scope) {
                    /* ssh key generating popup with custom template */
                    var sshKeyModalCtrl = function($scope, dialog) {
                        $scope.keyName = '';

                        $scope.close = function(res) {
                            $scope.loading = false;
                            dialog.close(res);
                        };

                        $scope.generateKey = function() {
                            $scope.close({generate: true, keyName: $scope.keyName});
                        };
                    };

                    var generateKeyPopup = function(question, callback) {
                        var title = 'Create SSH Key';
                        var btns = [{result:'cancel', label:'Cancel', cssClass: 'pull-left'}];
                        var templateUrl = 'account/static/template/dialog/generate-ssh-modal.html';

                        $scope.loading = true;
                        $dialog.messageBox(title, question, btns, templateUrl)
                            .open(templateUrl, sshKeyModalCtrl)
                            .then(function(data) {
                                if(data && data.generate === true) {
                                    var createUrl = '/main/account/ssh/create/';

                                    if($scope.nextStep) {
                                        createUrl = '/signup/account/ssh/create/';
                                    }

                                    $http.post(createUrl, {name: data.keyName})
                                        .success(function(data) {
                                            $scope.loading = false;
                                            if(data.success === true) {
                                                notification.push(null, { type: 'success' },
                                                    localization.translate($scope, null,
                                                        'SSH key successfully added to your account<br />You will be prompted for private key download shortly. Please keep your private key safe'
                                                    )
                                                );
                                                $window.open('http://'+ window.location.host +'/main/account/ssh/download/'+ data.keyId +'/'+ data.name +'');

                                                if($scope.updateInterval) {
                                                    $scope.updateInterval();
                                                }

                                                if($scope.nextStep) {
                                                    notification.push(null, { type: 'success', persistent: true },
                                                        localization.translate($scope, null,
                                                            'SSH Key successfully added to your account'
                                                        )
                                                    );
                                                    window.location.href = '/main';
                                                }
                                            } else {
                                                // error
                                                notification.push(null, { type: 'error' },
                                                    localization.translate($scope, null,
                                                        'Unable to generate SSH key: '+ data.err.message
                                                    )
                                                );
                                            }
                                        });

                                } else {
                                    $scope.loading = false;
                                }
                            });
                    };

                    /* SSH Key generation popup */
                    $scope.generateSshKey = function() {
                        generateKeyPopup('', function(keyData){

                        });
                    };

                },
                templateUrl: 'account/static/partials/account-ssh-create.html'
        };
}]);
}(window.JP.getModule('Account')));