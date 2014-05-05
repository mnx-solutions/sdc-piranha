'use strict';

(function (app) {
    app.controller(
        'Support.IndexController',
        ['$rootScope', '$scope', '$location', 'Support', '$route', 'PopupDialog', 'BillingService', 'localization', 'Account', '$timeout', function ($rootScope, $scope, $location, Support, $route, PopupDialog, BillingService, localization, Account, $timeout) {

            $scope.loading = true;
            $scope.subscribingInProgress = true;
            var supportPlanSelected = $rootScope.popCommonConfig('supportPlanSelected');
            var headLink = '/support';

            $scope.getPageData = function () {
                $scope.subscribingInProgress = true;
                $scope.levelSupport = 0;
                var supportPackages = $scope.supportPackages;
                supportPackages && supportPackages.forEach(function (supportPackage) {
                    if (headLink + supportPackage.link === $location.path()) {
                        $scope.package = supportPackage;
                        $scope.levelSupport = $scope.package.currentlevelSupport;
                        $scope.packageHolders = supportPackage.packageHolders;
                    }
                });
                $scope.loading = false;
                $scope.subscribingInProgress = false;

                if (supportPlanSelected) {
                    setupPackage(supportPlanSelected.package);
                    supportPlanSelected = null;
                }
            };

            var getSupportData = function () {
                Support.support(function (error, supportPackages) {
                    $scope.supportPackages = supportPackages;
                    $scope.getPageData();
                });
            };

            $scope.$on('$routeChangeStart', function(e, next, last) {
                if (next.$$route.controller === last.$$route.controller) {
                    e.preventDefault();
                    $route.current = last.$$route;
                    $scope.loading = true;
                    $scope.getPageData();
                }
            });

            var subscribe = function (supportPackage) {
                $scope.subscribingInProgress = true;
                BillingService.createSupportSubscription(supportPackage.ratePlanId, function (err) {
                    if (err) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'billing',
                                'Unable to subscribe to support plan, check your billing method.'
                            ),
                            function () {
                                $scope.subscribingInProgress = false;
                            }
                        );
                    }
                    getSupportData();
                });
            };

            function setupPackage(supportPackage, isUpgrade) {
                if (supportPackage.ratePlanId === '' || $scope.subscribingInProgress) {
                    return;
                }

                if (isUpgrade) {
                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                                'Confirm: ' + supportPackage.popUpTitle
                        ),
                        localization.translate(
                            $scope,
                            null,
                                'Are you sure you want to upgrade for ' + supportPackage.popUpTitle + '?'
                        ), function () {
                            subscribe(supportPackage);
                        }
                    );
                } else {
                    var confirmSignUp = function ($scope, dialog) {
                        $scope.title = supportPackage.popUpTitle;
                        $scope.close = function (res) {
                            dialog.close(res);
                        };
                        $scope.clickOk = function (res) {
                            subscribe(supportPackage);
                            dialog.close(res);
                        };
                    };

                    var opts = {
                        templateUrl: 'support/static/partials/popup.html',
                        openCtrl: confirmSignUp
                    };
                    PopupDialog.custom(
                        opts,
                        function () {}
                    );
                }
            }

            $scope.clickSignUp = function (supportPackage, isUpgrade) {
                var returnUrl = $location.path();
                Account.checkProvisioning({btnTitle: 'Submit and Upgrade Support'}, function () {
                    setupPackage(supportPackage, isUpgrade);
                }, angular.noop, function (isSuccess) {
                    $location.path(returnUrl);
                    if (isSuccess) {
                        $rootScope.commonConfig('supportPlanSelected', {
                            package: supportPackage
                        });
                    }
                });
            };

            $scope.clickCallSales = function (supportPackage) {
                Support.callSalesLog(supportPackage.title);
                PopupDialog.message(
                    localization.translate(
                        $scope,
                        null,
                        'Info: Call Sales'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Contact a Joyent representative at +1 855 4 JOYENT (+1 855 456-9368)'
                    ), function () {}
                );
            };

            getSupportData();
        }]);
}(window.JP.getModule('support')));
