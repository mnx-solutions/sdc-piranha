'use strict';

(function (app) {
    app.directive('machineStatus', [ 'localization', function (localization) {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                machine: '=machine'
            },

            controller: function($scope, $element, $attrs, $transclude) {
                localization.bind('machine', $scope);
            },

            link: function (scope) {
                scope.labelForState = function (state) {
                    switch (state) {
                        case 'provisioning':
                        case 'stopping':
                            return 'btn-warning';
                        case 'running':
                            return 'btn-success';
                        case 'stopped':
                            return '';
                        default:
                            return 'btn-danger';
                    }
                };
            },

            templateUrl: 'machine/static/partials/status.html'
        };
    }]);
}(window.JP.getModule('Machine')));