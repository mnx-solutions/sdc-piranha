'use strict';

(function (app) {
    app.controller(
        'slb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'slb.Service', 'PopupDialog', 'Account',
        function ($scope, requestContext, localization, $location, service, PopupDialog, Account) {
            localization.bind('slb', $scope);
            requestContext.setUpRenderContext('slb.index', $scope, {
                title: localization.translate(null, 'slb', 'Enable Load Balancing')
            });

            $scope.loaded = false;
            $scope.creating = service.creatingController;

            Account.getAccount().then(function (account) {
                if (account.provisionEnabled) {
                    service.getController().then(function () {
                        $location.path('/slb/list');
                    }, function () {
                        $scope.loaded = true;
                    });
                } else {
                    $scope.loaded = true;
                }
            });

            function showErrPopupDialog(error) {
                $scope.creating = false;
                return PopupDialog.errorObj(error);
            }

            $scope.enableSlb = function () {
                var returnUrl = $location.path();
                var submitBillingInfo = {
                    btnTitle: 'Submit and Install Load Balancer',
                    appendPopupMessage: 'Load balancer will now be installed.'
                };
                Account.checkProvisioning(submitBillingInfo, function () {
                    $scope.creating = true;
                    service.createController().then(function () {
                        if (returnUrl === $location.path()) {
                            $location.path('/slb/list');
                        }
                    }, showErrPopupDialog);
                }, function (isSuccess) {
                    $location.path(returnUrl);
                    if (isSuccess) {
                        $scope.enableSlb();
                    }
                });
            };
            // TODO get rid of this code. Angular makes this stuff natively via data-ng-model directive on checkbox.
            $scope.licenseAcceptCheck = false;

            $scope.licenseAccept = function () {
                $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
            };

        }]
    );
}(window.JP.getModule('slb')));
