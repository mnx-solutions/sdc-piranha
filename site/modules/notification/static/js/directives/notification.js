'use strict';

(function (app) {
    app.directive('notification', [ 'notification', function (notification) {
        return {
            restrict: 'EA',
            replace: true,
            priority: 20,

            link: function (scope) {
            },

            controller: function ($scope, requestContext, localization) {
                localization.bind('notification', $scope);

                $scope.notifications = notification.getPersistentNotifications();

                $scope.close = function (ctx, type) {
                    if ($scope.notifications[ctx][type]) {
                        notification.dismissNotifications($scope.notifications[ctx][type]);
                    }
                };

                $scope.$on('notification:change', function (scope) {
                    $scope.notifications = notification.getNotifications();
                });
            },
            template: '<div class="notification-wrapper">' +
                '<div data-ng-repeat="(ctx, groups) in notifications">' +
                '<alert data-ng-repeat="(type, group) in groups" type="type" close="close(ctx, type)">' +
                '<div data-ng-repeat="notification in group" data-ng-bind-html-unsafe="notification.message"></div>' +
                '</alert>' +
                '</div>' +
                '</div>'
        };
    }]);
}(window.JP.getModule('notification')));