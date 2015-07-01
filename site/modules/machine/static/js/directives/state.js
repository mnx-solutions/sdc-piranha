'use strict';

(function (app) {
    app.directive('objectState', ['localization', function (localization) {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                object: '=object',
                type: '@'
            },

            controller: function($scope) {
                localization.bind('machine', $scope);
            },

            link: function (scope) {
                scope.type = scope.type || 'machine';

                scope.labelForState = function (state) {
                    if (scope.type === 'user') {
                        return 'state-label';
                    } else if (scope.type === 'machine') {
                        switch (state) {
                            case 'provisioning':
                            case 'pausing':
                                return 'btn-default';

                            case 'running':
                                return 'btn-success';

                            case 'paused':
                                return '';

                            default:
                                return 'btn-default';
                        }
                    } else if (scope.type === 'container') {
                        switch (state) {
                            case 'stopped':
                            case 'paused':
                                return 'btn-default';

                            case 'running':
                                return 'btn-success';

                            default:
                                return 'btn-default';
                        }
                    } else {
                        switch (state) {
                            case 'active':
                                return 'btn-success';
                            case 'paused':
                                return '';
                            default:
                                return '';
                        }
                    }
                };
            },

            templateUrl: 'machine/static/partials/state.html'
        };
    }]);
}(window.JP.getModule('Machine')));
