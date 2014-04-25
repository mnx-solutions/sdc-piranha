'use strict';

(function (app) {
    app.controller(
        'slb.IndexController',
        ['$rootScope', '$scope', 'requestContext', 'localization', '$location', 'slb.Service', 'Datacenter', 'PopupDialog', 'Account',
        function ($rootScope, $scope, requestContext, localization, $location, service, Datacenter, PopupDialog, Account) {
            localization.bind('slb', $scope);
            requestContext.setUpRenderContext('slb.index', $scope, {
                title: localization.translate(null, 'slb', 'Enable Load Balancing')
            });

            $scope.loaded = false;
            $scope.creating = false;

            service.getController().then(function () {
                $location.path('/slb/list');
            }, function () {
                $scope.loaded = true;
            });

            function showPopupDialog(level, title, message, callback) {
                return PopupDialog[level](
                    title ? localization.translate(
                        $scope,
                        null,
                        title
                    ) : null,
                    message ? localization.translate(
                        $scope,
                        null,
                        message
                    ) : null,
                    callback
                );
            }

            function showErrPopupDialog(error) {
                $scope.creating = false;
                return PopupDialog.errorObj(error);
            }

            $scope.enableSlb = function () {
                var returnUrl = $location.path();
                $rootScope.commonConfig('addedMessageText', ' Load balancer will now be installed.');
                Account.checkProvisioning('Submit and install load balancer', function () {
                    $scope.creating = true;
                    service.createController().then(function () {
                        $location.path('/slb/list');
                    }, showErrPopupDialog);
                }, function () {
                    $rootScope.commonConfig('licenseAcceptCheck', $scope.licenseAcceptCheck);
                }, function (isSuccess) {
                    $location.path(returnUrl);
                    if (isSuccess) {
                        $scope.enableSlb();
                    }
                });
            };
            $scope.licenseAcceptCheck = $rootScope.commonConfig('licenseAcceptCheck') || false;
            $rootScope.clearCommonConfig('licenseAcceptCheck');

            $scope.licenseAccept = function () {
                $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
            };

        }]
    );
}(window.JP.getModule('slb')));
