'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', 'Account', 'localization', 'requestContext', function ($scope, Account, localization, requestContext) {
            requestContext.setUpRenderContext('account.index', $scope);
            localization.bind('account', $scope);
            $scope.pages = {
                ssh: {
                    name: "SSH Keys",
                    url: '#!/account/ssh'
                },
                edit: {
                    name: "Edit account",
                    url: '#!/account/edit'
                },
                payment: {
                    name: "Payment",
                    url: '#!/account/payment'
                }
            };

        }]);
}(window.JP.getModule('Account')));