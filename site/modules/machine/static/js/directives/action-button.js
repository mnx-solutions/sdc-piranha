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
                getTooltip: '=tooltipFn',
                object: '='
            },

            controller: function($scope) {
            },

            link: function ($scope) {
                if(!$scope.show) {
                    $scope.show = function() {
                        return true;
                    }
                }
            },

            templateUrl: 'machine/static/partials/action-button.html'
        };
    }]);
}(window.JP.getModule('Machine')));