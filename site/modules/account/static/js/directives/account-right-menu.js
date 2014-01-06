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

                controller: function($scope, $element, $attrs, $transclude) { //REVIEW: Why all these unused things?
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.hash = $location.path();

                    $scope.pages = [
                        {
                            sequence: 1,
                            name: 'Summary',
                            url: '/account'
                        },
                        {
                            sequence: 5,
                            name: 'SSH Keys',
                            url: '/account/ssh'
                        },
                        {
                            sequence: 2,
                            name: 'Edit Account',
                            url: '/account/edit'
                        },
                        {
                            sequence: 3,
                            name: 'Billing',
                            url: '/account/payment'
                        }
                    ];
                    if($scope.features.invoices !== 'disabled') {
                        $scope.pages.push({
                            sequence: 4,
                            name: 'Invoices',
                            url: '/account/invoices'
                        });
                    }
                },
                template: '<div class="sizebar-fix">' +
                    '<div class="tabbable tabs-right">' +
                    '<ul class="nav nav-tabs">' +
                    '<li data-ng-repeat="(k, v) in (pages | orderBy:\'sequence\')" class="{{hash == v.url && \'active\' || \'\'}}"><a href="#!{{v.url}}" data-translate="value">{{v.name}}</a></li>' +
                    '</ul>' +
                    '</div>' +
                    '<div class="clearfix"></div></div>'
            };
        }]);
}(window.JP.getModule('Account')));
