'use strict';

(function (app) {
    var supportGroups = null;
    app.factory('Support', [
        'serverTab', 'BillingService', '$q',
        function (serverTab, BillingService, $q) {
            var service = {};

            service.support = function (callback) {
                serverTab.call({
                    name: 'SupportListPackages',
                    done: function (err, job) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        supportGroups = job.__read();

                        var supportGroupsArr = []
                        for (var supportGroupName in supportGroups) {
                            var supportGroup = supportGroups[supportGroupName];
                            supportGroup.name = supportGroupName;
                            supportGroupsArr.push(supportGroup);
                        }

                        var supportGroupSkuRequests = supportGroupsArr.map(function (supportGroup) {
                            return supportGroup.sku;
                        }).filter(function (value, index, arr) {
                            return arr.indexOf(value) === index;
                        }).map(function (sku) {
                            return BillingService.getProductRatePlans(sku);
                        });

                        var getRatePlanId = function (skuResults, ratePlanName) {
                            var result = null;
                            skuResults.forEach(function (products) {
                                products.forEach(function (product) {
                                    var matchingRatePlans = product.productRatePlans.filter(function (ratePlan) {
                                        return ratePlan.name === ratePlanName;
                                    });
                                    if (matchingRatePlans.length > 0) {
                                        result = matchingRatePlans[0].id;
                                    }
                                });
                            });
                            return result;
                        };

                        BillingService.getSubscriptions().then(function (subscriptions) {
                            var subscribedRatePlanIds = [];
                            subscriptions.forEach(function (subscription) {
                                if (subscription.status === 'Active') {
                                    subscription.ratePlans.forEach(function (ratePlan) {
                                        subscribedRatePlanIds.push(ratePlan.productRatePlanId);
                                    });
                                }
                            });
                            $q.all(supportGroupSkuRequests).then(function (skuResults) {
                                supportGroupsArr.forEach(function (supportGroup) {
                                    supportGroup.packageHolders.forEach(function (packageHolder) {
                                        packageHolder.ratePlanId = getRatePlanId(skuResults, packageHolder.ratePlanName);
                                        if (packageHolder.ratePlanId && subscribedRatePlanIds.indexOf(packageHolder.ratePlanId) !== -1) {
                                            packageHolder.active = true;
                                            if (supportGroup.currentlevelSupport <= packageHolder.levelSupport) {
                                                supportGroup.currentlevelSupport = packageHolder.levelSupport;
                                                supportGroup.currentShortName = packageHolder.shortName;
                                            }
                                        }
                                    });
                                });
                                callback(null, supportGroupsArr);
                            });
                        }, function (err) {
                            callback(err);
                        });
                    }
                });

            };

            service.callSalesLog = function (supportPlanName) {
                serverTab.call({
                    name: 'SupportCallSales',
                    data: supportPlanName
                });
            }

            return service;
        }]);
}(window.JP.getModule('support')));

