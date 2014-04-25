'use strict';

(function (app) {
    app.controller(
        'slb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'slb.Service', 'Datacenter', 'PopupDialog', 'Account',
        function ($scope, requestContext, localization, $location, service, Datacenter, PopupDialog, Account) {
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
                Account.checkProvisioning('Submit and install load balancer', function () {
                    $scope.creating = true;
                    service.createController().then(function () {
                        $location.path('/slb/list');
                    }, showErrPopupDialog);
                });
            };

            $scope.licenseAcceptCheck = false;
            $scope.licenseAccept = function () {
                $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
            };

        }]
    );
}(window.JP.getModule('slb')));
