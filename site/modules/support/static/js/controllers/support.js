'use strict';

(function (app) {
    app.controller(
        'Support.IndexController',
        ['$rootScope', '$scope', '$location', 'Support', '$route', 'PopupDialog', 'BillingService', 'localization', 'Account', function ($rootScope, $scope, $location, Support, $route, PopupDialog, BillingService, localization, Account) {

            $scope.loading = true;
            $scope.subscribingInProgress = true;
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
            };

            var getSupportData = function () {
                Account.checkProvisioning({btnTitle: 'Submit and access Support'}, function () {
                    Support.support(function (error, supportPackages) {
                        $rootScope.$broadcast('event:provisionChanged');
                        $scope.supportPackages = supportPackages;
                        $scope.getPageData();
                    });
                }, function () {}, function (isSuccess) {
                    $location.path(isSuccess ? '/support/cloud' : '/');
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

            var subscribe = function (holder) {
                $scope.subscribingInProgress = true;
                BillingService.createSupportSubscription(holder.ratePlanId, function (err) {
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
            }

            $scope.clickSignUp = function (holder, signup) {
                if (holder.ratePlanId === '' || $scope.subscribingInProgress) {
                    return;
                }

                if (signup) {
                    var confirmSignUp = function ($scope, dialog) {
                        $scope.title = holder.popUpTitle;
                        $scope.close = function (res) {
                            dialog.close(res);
                        };
                        $scope.clickOk = function (res) {
                            subscribe(holder);
                            dialog.close(res);
                        }
                    };

                    var opts = {
                        templateUrl: 'support/static/partials/popup.html',
                        openCtrl: confirmSignUp
                    };
                    PopupDialog.custom(
                        opts,
                        function () {}
                    );
                } else {
                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: ' + holder.popUpTitle
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Are you sure you want to upgrade for ' + holder.popUpTitle + '?'
                        ), function () {
                            subscribe(holder);
                        }
                    );
                }
            };

            $scope.clickCallSales = function (holder) {
                Support.callSalesLog(holder.title);
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
            }

            getSupportData();

        }]);
}(window.JP.getModule('support')));
