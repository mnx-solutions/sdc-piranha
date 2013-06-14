'use strict';

(function (app) {

    app.directive('accountRightMenu', [
        '$location',
        'localization',

        function ($location, localization) {

            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.hash = $location.path();

                    $scope.pages = [{
                        sequence: 1,
                        name: 'Summary',
                        url: '/account'
                    },
                        {
                            sequence: 4,
                            name: 'SSH keys',
                            url: '/account/ssh'
                        },
                        {
                            sequence: 2,
                            name: 'Edit account',
                            url: '/account/edit'
                        },
                        {
                            sequence: 3,
                            name: 'Payment',
                            url: '/account/payment'
                        }];
                },
                template: '<div class="span12">' +
                    '<div class="tabbable tabs-right">' +
                    '<ul class="nav nav-tabs span12">' +
                    '<li data-ng-repeat="(k, v) in (pages | orderBy:\'sequence\')" class="{{hash == v.url && \'active\' || \'\'}}"><a href="#!{{v.url}}" data-translate="value">{{v.name}}</a></li>' +
                    '</ul>' +
                    '</div>' +
                    '</div>'
            };
        }]);
}(window.JP.getModule('Account')));