'use strict';

(function (app) {

    app.directive('accountAddSshKey', [
        'Account',
        'localization',
        'notification',
        '$q',
        '$window',
        '$dialog',
        '$timeout',
        '$http',
        function (Account, localization, notification, $q, $window, $dialog, $timeout, $http) {
            return {
                restrict: 'A',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);

                },

                link: function ($scope) {
                },
                templateUrl: 'account/static/partials/account-add-ssh-key.html'
            };
        }]);
}(window.JP.getModule('Account')));