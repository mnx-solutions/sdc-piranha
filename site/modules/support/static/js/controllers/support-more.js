'use strict';

(function (app) {
    app.controller(
        'Support.MoreController',
        ['$scope', '$location', 'Support', '$route', 'PopupDialog', 'BillingService', 'localization', function ($scope, $location, Support, $route, PopupDialog, BillingService, localization) {

            $scope.loading = true;
            $scope.subscribingInProgress = true;
            var headLink = '/support';
            $scope.getPageData = function () {
                $scope.levelSupport = 0;
                var supportPackages = $scope.supportPackages;
                for (var packageName in supportPackages ) {
                    if (headLink + supportPackages[packageName].link === $location.path()) {
                        $scope.package = supportPackages[packageName];
                        $scope.packageHolders = supportPackages[packageName].packageHolders;
                    }
                }

                BillingService.getSubscriptions().then(function (subscriptions) {
                    var filteredSubscriptions = subscriptions.filter(function (subscription) {
                        return subscription.status === "Active";
                    });

                    filteredSubscriptions.forEach(function (filteredSubscription) {
                        if (filteredSubscription.ratePlans.length) {
                            filteredSubscription.ratePlans.forEach (function (el) {
                                for (var holder in $scope.packageHolders) {
                                    if (el.productRatePlanId === $scope.packageHolders[holder].ratePlanId) {
                                        $scope.packageHolders[holder].active = true;
                                        if ($scope.levelSupport <= $scope.packageHolders[holder].levelSupport) {
                                            $scope.levelSupport = $scope.packageHolders[holder].levelSupport;
                                        }
                                        $scope.packageHolders[holder].subscriptionId = filteredSubscription.id;
                                    }
                                }
                            });
                        }
                    });
                    $scope.loading = false;
                    $scope.subscribingInProgress = false;
                });

            };

            Support.support(function (error, supportPackages) {
                $scope.supportPackages = supportPackages;
                $scope.getPageData();
            });

            $scope.$on('$routeChangeStart', function(e, next, last) {
                if (next.$$route.controller === last.$$route.controller) {
                    e.preventDefault();
                    $route.current = last.$$route;
                    $scope.loading = true;
                    $scope.getPageData();
                }
            });

            $scope.clickSignUp = function (holder) {
                if (holder.ratePlanId === '' || $scope.subscribingInProgress) {
                    return;
                }

                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: ' + holder.popUpTitle
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to sign up for ' + holder.popUpTitle + '?'
                    ), function () {
                        $scope.subscribingInProgress = true;
                        BillingService.createSupportSubscription(holder.ratePlanId, function () {
                            $scope.getPageData();
                        });
                    });
            };

            $scope.clickUnsubscribe = function (holder) {
                if ($scope.subscribingInProgress) {
                    return;
                }

                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Cancel Subscription'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to cancel subscription'
                    ), function () {
                        $scope.subscribingInProgress = true;
                        BillingService.cancelSupportSubscription(holder.subscriptionId, function () {
                            holder.active = false;
                            $scope.getPageData();
                        });
                    });

            };

            $scope.clickCallSales = function () {
                PopupDialog.message(
                    localization.translate(
                        $scope,
                        null,
                        'Info: Call Sales'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Contact a Joyent representative at +1 855 4'
                    ), function () {}
                );
            }

        }]);
}(window.JP.getModule('support')));
