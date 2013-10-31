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
        '$rootScope',
        function (Account, localization, notification, $q, $window, $dialog, $timeout, $http, $rootScope) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);

                    $scope.loading = false;
                    $rootScope.downloadLink = false;
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

                        $rootScope.loading = true;
                        $dialog.messageBox(title, question, btns, templateUrl)
                            .open(templateUrl, sshKeyModalCtrl)
                            .then(function(data) {
                                if(data && data.generate === true) {
                                    var createUrl = 'account/ssh/create/';


                                    $http.post(createUrl, {name: data.keyName})
                                        .success(function(data) {

                                            var jobId = data.jobId;
                                            if(data.success === true) {
                                                notification.push(null, { type: 'success' },
                                                    localization.translate($scope, null,
                                                        'SSH key successfully added to your account<br />You will be prompted for private key download shortly. Please keep your private key safe'
                                                    )
                                                );

                                                var downloadLink = window.location.protocol +'//'+ window.location.host +'/main/account/ssh/download/'+ jobId +'/'+ data.keyId +'/'+ data.name;
                                                // as this is directive, we need to use rootScope here
                                                $rootScope.pollingJob = true;
                                                $rootScope.loading = false;
                                                $scope.iframe = '<iframe src="'+ downloadLink +'"></iframe>';

                                                // tell the rootScope that we are loading
                                                $rootScope.downloadLink = downloadLink;

                                                // start polling
                                                var pollingJob = setInterval(function() {
                                                    $http.get('/main/account/ssh/job/'+ jobId).success(function(data) {
                                                        if(data.success === true) {
                                                            $rootScope.loading = false;
                                                            $rootScope.pollingJob = false;
                                                            clearInterval(pollingJob);

                                                            if($scope.updateInterval) {
                                                                $scope.updateInterval();
                                                            }

                                                            if($scope.nextStep) {
                                                                window.location.href = '/main/#!/account/ssh';
                                                            }
                                                        }
                                                        if(data.success === false) {
                                                            $rootScope.loading = false;
                                                            $rootScope.pollingJob = false;
                                                            notification.push(null, { type: 'error' },
                                                                localization.translate($scope, null,
                                                                    'SSH Key generation error'
                                                                )
                                                            );

                                                            clearInterval(pollingJob);
                                                        }
                                                    })
                                                }, 1000);

                                                var pollingTimeout = setTimeout(function() {
                                                    clearInterval(pollingJob);
                                                    clearTimeout(pollingTimeout);
                                                    $rootScope.loading = false;
                                                    $rootScope.pollingJob = false;
                                                    notification.push(null, { type: 'error' },
                                                        localization.translate($scope, null,
                                                            'SSH Key generation error'
                                                        )
                                                    );

                                                }, 2*60*1000);

                                            } else {
                                                // error
                                                $rootScope.loading = false;
                                                $rootScope.pollingJob = false;
                                                notification.push(null, { type: 'error' },
                                                    localization.translate($scope, null,
                                                        'Unable to generate SSH key: '+ data.err.message
                                                    )
                                                );
                                            }
                                        });

                                } else {
                                    $rootScope.loading = false;
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