'use strict';

(function (app) {

    app.directive('sshForm', [
        'Account',
        'localization',
        'notification',
        '$q',
        '$window',
        '$timeout',
        '$http',
        function (Account, localization, notification, $q, $window, $timeout, $http) {
            return {
                restrict: 'A',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                },
                templateUrl: 'account/static/partials/ssh-form.html'
            };
        }]);
}(window.JP.getModule('Account')));