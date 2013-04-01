'use strict';

(function (app) {
    app.directive('notification', [ 'notification', function (notification) {
        return {
            link: function (scope) {
            },

            controller: function ($scope, requestContext, localization) {
                localization.bind('notification', $scope);

                $scope.close = function (index) {
                    notification.dismissAtIndex(index);
                };

                $scope.$on('notification:change', function (scope) {
                    $scope.notifications = notification.getNotifications();
                });
            },
            template: '<div class="notification-wrapper"><alert ng-repeat="notification in notifications" ' +
                'type="notification.type" close="close($index)">{{notification.message}}</alert></div>'
        };
    }]);
}(window.JP.getModule('notification')));