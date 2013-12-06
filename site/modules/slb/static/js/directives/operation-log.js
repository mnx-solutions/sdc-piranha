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
            template: '<ul data-ng-repeat="message in messages">' +
                '<li>{{message}}</li>' +
                '</ul>'
        };
    }]);
}(window.JP.getModule('slb')));
