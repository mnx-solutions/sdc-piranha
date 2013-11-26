'use strict';

(function (app) {

    app.directive('sshForm', [
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
                    $scope.accordionIcon3 = {};
                    $scope.collapseTrigger3 = function(item, items){
                        for(var i = 0; i < items; i++){
                            $scope.accordionIcon3[i] = false;
                        }
                        $scope.accordionIcon3[item] = true;
                        return $scope.accordionIcon3[item];
                    };

                },

                link: function ($scope) {
                },
                templateUrl: 'account/static/partials/ssh-form.html'
            };
        }]);
}(window.JP.getModule('Account')));