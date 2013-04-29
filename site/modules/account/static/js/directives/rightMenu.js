'use strict';

(function (app) {

    app.directive('accountRightMenu',['$location', function ($location) {

        return {
            restrict: 'A',
            replace: true,
            scope: true,
            link: function ($scope) {
                $scope.hash = $location.path();

                $scope.pages = [{
                    sequence: 1,
                    name: 'Summary',
                    url: '/account'
                },
                {
                    sequence: 4,
                    name: 'SSH Keys',
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
            template: '<div class="pull-right">' +
                '<div class="tabbable tabs-right">' +
                    '<ul class="nav nav-tabs span3">' +
                        '<li data-ng-repeat="(k, v) in (pages | orderBy:\'sequence\')" class="{{hash == v.url && \'active\' || \'\'}}"><a href="#!{{v.url}}" data-translate="value">{{v.name}}</a></li>' +
                    '</ul>' +
                '</div>' +
            '</div>'
        };
    }]);
}(window.JP.getModule('Machine')));