'use strict';

(function (app) {
    app.controller(
        'AccountController', [
            '$scope',
            'Account',
            'localization',
            'requestContext',
            'BillingService',
            '$q',

            function ($scope, Account, localization, requestContext, BillingService, $q) {
                localization.bind('account', $scope);
                requestContext.setUpRenderContext('account.index', $scope);

                $scope.loading = true;
                $scope.account = Account.getAccount();

                $q.all([
                    $scope.account
                ]).then(function () {
                    $scope.loading = false;
                });

                $scope.openKeyDetails = null;
                $scope.setOpenDetails = function(id) {
                    if ($scope.openKeyDetails === id) {
                        $scope.openKeyDetails = null;
                    } else {
                        $scope.openKeyDetails = id;
                    }
                };

                $scope.summary = true;

                $scope.accordionIcon3 = {};
                $scope.collapseTrigger3 = function(item, items){
                    for(var i = 0; i < items; i++){
                        $scope.accordionIcon3[i] = false;
                    }
                    $scope.accordionIcon3[item] = true;
                    return $scope.accordionIcon3[item];
                };
            }]);
}(window.JP.getModule('Account')));