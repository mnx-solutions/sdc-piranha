'use strict';

(function (app) {
    app.controller(
        'Support.IndexController',
        ['$rootScope', '$scope', '$location', 'Support', '$route', 'PopupDialog', 'BillingService', 'localization', 'Account', '$q', function ($rootScope, scope, $location, Support, $route, PopupDialog, BillingService, localization, Account, $q) {

            scope.loading = true;
            scope.subscribingInProgress = true;
            var supportPlanSelected = $rootScope.popCommonConfig('supportPlanSelected');
            var headLink = '/support';

            var supportTracking = function (supportPackage, comment) {
                var type = scope.package.type;
                $q.when(Account.getAccount(), function (account) {
                    var data = {
                        id: account.id,
                        marketo: {}
                    };
                    var title = type === 'portal' ? 'Support__Title__c' : 'Support__Title__Nodejs__c';
                    var comments = type === 'portal' ? 'Support__Comments__c' : 'Support__Comments__Nodejs__c';
                    var billingTag = type === 'portal' ? 'Support__BillingTag__c' : 'Support__BillingTag__Nodejs__c';

                    data.marketo[title] = supportPackage.ratePlanName || supportPackage.title;
                    data.marketo[comments] = comment || 'I want to subscribe to support plan: ' + supportPackage.title;
                    data.marketo[billingTag] = supportPackage.billingTag || supportPackage.ratePlanId;

                    Support.callTracking(data);
                });
            };

            var getSupportData = function () {
                Account.getAccount().then(function (account) {
                    Support.support(function (error, supportPackages) {
                        scope.supportPackages = supportPackages;
                        scope.getPageData();
                    }, !account.provisionEnabled);
                });
            };

            var subscribe = function (supportPackage) {
                scope.subscribingInProgress = true;
                var ratePlansToUnsubscribe = [];
                scope.packageHolders.forEach(function (packageHolder) {
                    if (packageHolder.ratePlanId) {
                        ratePlansToUnsubscribe.push(packageHolder.ratePlanId);
                    }
                });
                BillingService.cancelSupportSubscriptions(ratePlansToUnsubscribe, function () {
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
                                    scope.subscribingInProgress = false;
                                }
                            );
                        } else {
                            supportTracking(supportPackage);
                        }
                        getSupportData();
                    });
                });
            };

            var setupPackage = function (supportPackage, isUpgrade) {
                if (supportPackage.ratePlanId === '' || scope.subscribingInProgress) {
                    return;
                }

                if (isUpgrade) {
                    PopupDialog.confirm(
                        localization.translate(
                            scope,
                            null,
                                'Confirm: ' + supportPackage.popUpTitle
                        ),
                        localization.translate(
                            scope,
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
            };



            scope.$on('$routeChangeStart', function(e, next, last) {
                if (next.$$route.controller === last.$$route.controller) {
                    e.preventDefault();
                    $route.current = last.$$route;
                    scope.loading = true;
                    scope.getPageData();
                }
            });

            scope.getPageData = function () {
                scope.subscribingInProgress = true;
                scope.levelSupport = 0;
                var supportPackages = scope.supportPackages;
                if (supportPackages) {
                    supportPackages.forEach(function (supportPackage) {
                        if (headLink + supportPackage.link === $location.path()) {
                            scope.package = supportPackage;
                            scope.levelSupport = scope.package.currentlevelSupport;
                            scope.packageHolders = supportPackage.packageHolders;
                        }
                    });
                }
                scope.loading = false;
                scope.subscribingInProgress = false;

                if (supportPlanSelected) {
                    setupPackage(supportPlanSelected.package);
                    supportPlanSelected = null;
                }
            };

            scope.clickSignUp = function (supportPackage, isUpgrade) {
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

            scope.clickCallSales = function (supportPackage) {
                var confirmContactForm = function ($scope, dialog) {

                    $scope.popUpTitle = supportPackage.popUpTitle;
                    $scope.comments = 'I want to subscribe to support plan: ' + supportPackage.title;

                    $scope.close = function (res) {
                        dialog.close(res);
                    };

                    $scope.submitForm = function (isValid) {
                        if (isValid) {
                            supportTracking(supportPackage, $scope.comments);
                            dialog.close();
                        }
                    };
                };

                var opts = {
                    templateUrl: 'support/static/partials/popup-contact.html',
                    openCtrl: confirmContactForm
                };
                PopupDialog.custom(opts);
            };


            getSupportData();
        }]);
}(window.JP.getModule('support')));
