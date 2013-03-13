'use strict';

(function (app) {
// app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
    app.directive('debugWindow', [ 'serverCallInternals', function ( serverCalls) {
        return {
            link: function ($scope) {
                $scope.calls = serverCalls().calls;
                $scope.oldCalls = serverCalls().history;
            },

            template: '<div class="debug"><div class="pull-left"><h3>Ongoing calls</h3><div class="jobs">' +
                '<ul>' +
                '<li data-ng-repeat="call in calls"">' +
                '<span class="name">running: {{call.name}}</span>' +
                '</li>' +
                '<li data-ng-repeat="call in oldCalls" data-ng-class="{ succeeded: !call.error}">' +
                '<span class="name">finished: {{call.name}} in {{call.endTime-call.startTime}}ms</span>' +
                '</li>' +
                '</ul></div></div>' +
                '</div>'
        };
    }]);
}(window.JP.getModule('Debug')));