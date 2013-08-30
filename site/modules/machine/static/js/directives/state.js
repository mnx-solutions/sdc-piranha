'use strict';

(function (app) {
    app.directive('objectState', [ 'localization', function (localization) {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                object: '=object',
                type: '=type'
            },

            controller: function($scope) {
                localization.bind('machine', $scope);
            },

            link: function (scope) {
                scope.type = scope.type || 'machine';

                scope.labelForState = function (state) {
                    if(scope.type ===  'machine') {
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
                    } else {
                        console.log('stae: ' + state);
                        switch (state) {
                            case 'active':
                                return 'btn-success';

                            default:
                            case 'stopped':
                                return '';
                        }
                    }
                };
            },

            templateUrl: 'machine/static/partials/state.html'
        };
    }]);
}(window.JP.getModule('Machine')));