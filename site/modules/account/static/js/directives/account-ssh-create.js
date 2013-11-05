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

                    $rootScope.downloadLink = false;
                },
                link: function ($scope) {
                    /* SSH Key generation popup */
                    $scope.generateSshKey = function() {
                        var title = 'Create SSH Key';
                        var btns = [{result:'cancel', label:'Cancel', cssClass: 'pull-left'}];
                        var templateUrl = 'account/static/template/dialog/generate-ssh-modal.html';
                        /* ssh key generating popup with custom template */
                        var sshKeyModalCtrl = function($scope, dialog) {
                            $scope.keyName = '';

                            $scope.close = function(res) {
                                if(!res || !res.generate) {
                                    $rootScope.loading = false;
                                }
                                dialog.close(res);
                            };

                            $scope.generateKey = function() {
                                $rootScope.loading = true;
                                $scope.close({generate: true, keyName: $scope.keyName});
                            };
                        };

                        $rootScope.loading = true;
                        $dialog.messageBox(title, '', btns, templateUrl)
                            .open(templateUrl, sshKeyModalCtrl)
                            .then(function(data) {
                                if(data && data.generate === true) {
                                    var createUrl = 'account/ssh/create/';

                                    $http.post(createUrl, {name: data.keyName})
                                        .success(function(data) {

                                            var jobId = data.jobId;
                                            if(data.success === true) {

                                                var downloadLink = 'account/ssh/download/'+ jobId;

                                                // as this is directive, we need to use rootScope here
                                                $rootScope.pollingJob = true;
                                                $rootScope.loading = false;

                                                if($scope.updateKeys) {
                                                    $scope.updateKeys(function() {
                                                        // if we are in signup, show the download right away
                                                        $scope.iframe = '<iframe src="'+ downloadLink +'"></iframe>';
                                                        $rootScope.downloadLink = downloadLink;

                                                        notification.push(null, { type: 'success' },
                                                            localization.translate($scope, null,
                                                                'SSH key successfully added to your account<br />You will be prompted for private key download shortly. Please keep your private key safe'
                                                            )
                                                        );
                                                    });
                                                } else {
                                                    // if we are in signup, show the download right away
                                                    $scope.iframe = '<iframe src="'+ downloadLink +'"></iframe>';
                                                    $rootScope.downloadLink = downloadLink;
                                                }

                                                // start polling
                                                var pollingJob = setInterval(function() {
                                                    $http.get('account/ssh/job/'+ jobId).success(function(data) {
                                                        if(data.success === true) {
                                                            // user has downloaded the key
                                                            $rootScope.loading = false;
                                                            $rootScope.pollingJob = false;
                                                            clearInterval(pollingJob);

                                                            if($scope.nextStep) {
                                                                $http.get('/signup/account/signup/passSsh').success(function(data) {
                                                                    // marked ssh step as passed
                                                                    window.location.href = '/main/#!/account/ssh';
                                                                });
                                                            }
                                                        }
                                                        if(data.success === false) {
                                                            // key download failed, show error
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
                },
                templateUrl: 'account/static/partials/account-ssh-create.html'
        };
}]);
}(window.JP.getModule('Account')));