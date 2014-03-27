'use strict';

(function (app) {
    app.directive('operationLog', ['$rootScope', function ($rootScope) {
        return {
            restrict: 'EA',
            scope: {},
            link: function (scope, element, attrs) {
                scope.messages = [];

                $rootScope.operationLog = {
                    add: function (message) {
                        scope.messages.push(message);
                    },
                    clear: function () {
                        scope.messages = [];
                    },
                    set: function (message) {
                        scope.messages = [message];
                    }
                };
            },
            template: '<div class="operation-box" data-ng-show="messages.length > 0">' +
                '<p data-ng-repeat="message in messages">{{message}}</p>' +
                '</div>'
        };
    }]);
}(window.JP.getModule('slb')));
