'use strict';

(function (app) {
    var cache = null;
    app.factory('Support', [
        'serverTab', 'BillingService',
        function (serverTab, BillingService) {
            var service = {};

            service.support = function (callback) {
                serverTab.call({
                    name: 'SupportListPackages',
                    done: function (err, job) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        cache = job.__read();

                        BillingService.getSubscriptions().then(function (subscriptions) {
                            var filteredSubscriptionsId = [];
                            subscriptions.forEach(function (subscription) {
                                if (subscription.status === "Active") {
                                    subscription.ratePlans.forEach(function (ratePlan) {
                                        filteredSubscriptionsId.push(ratePlan.productRatePlanId);
                                    });
                                }
                            });
                            for (var name in cache) {
                                cache[name].packageHolders.forEach(function (holder) {
                                    for (var id in filteredSubscriptionsId) {
                                        if (holder.ratePlanId === filteredSubscriptionsId[id]) {
                                            holder.active = true;
                                            if (cache[name].currentlevelSupport <= holder.levelSupport) {
                                                cache[name].currentlevelSupport = holder.levelSupport;
                                                cache[name].currentShortName = holder.shortName;
                                            }
                                        }
                                    }
                                });
                            }
                            callback(null, cache);
                        });
                    }
                });

            };
            return service;
        }]);
}(window.JP.getModule('support')));

