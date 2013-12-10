'use strict';

(function (app) {
    app.directive('actionButton', [function () {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                doAction: '=actionFn',
                isDisabled: '=disabledFn',
	            getClass: '=classFn',
                show: '=showFn',
	            getLabel: '=labelFn',
                label: '=',
                tooltip: '=tooltipText',
                object: '='
            },

            controller: function($scope) {
            },

            link: function ($scope) {
            },

            templateUrl: 'machine/static/partials/action-button.html'
        };
    }]);
}(window.JP.getModule('Machine')));