'use strict';

(function (app) {
// app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
    app.directive('debugWindow', [ 'Jobs','serverCalls', function ( Jobs , serverCalls) {
            return {
                link: function ($scope) {
                    $scope.calls = serverCalls();
                },
                controller: function ($scope, requestContext) {
                    /*Events.
                    $scope.$on('requestContextChanged', function () {
                        $scope.mainMenu.forEach(function (item) {
                            item.active = requestContext.startsWith(item.link);
                        });
                    });*/
                },
                template: '<div class="debug"><div class="pull-left"><h3>Ongoing calls</h3><div class="jobs">' +
                        '<ul>' +
                        '<li data-ng-repeat="call in calls" data-ng-class="{running: !job.isFinished, failed:job.isFailed}">' +
                        '<span class="name">{{call.name}}</span>' +
                        '' +
                        '</li>' +
                        '</ul></div></div>' +
                    '</div>'
            };
        }]);
}(window.JP.getModule('Debug')));