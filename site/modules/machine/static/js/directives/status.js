'use strict';

(function (app) {

    app.directive('machineStatus', function () {

        return {
            restrict: 'E',
            replace: true,
            scope: {
                machine: '=machine'
            },
            link: function (scope) {
                scope.labelForState = function (state) {
                    switch (state) {
                        case 'running':
                            return 'btn-success';
                        case 'stopped':
                            return '';
                        default:
                            return 'btn-danger';
                    }
                };
            },
			//<span class="status label label-info">Started</span>
            template: '<div><span class="status label label-info" ng-class="labelForState(machine.state)" ng-show="!machine.job || machine.job.finished">' +
                '{{machine.state}}</span>' +
                '<span class="loading-small" ng-show="machine.job && !machine.job.finished">' +
                '</span>' +
				'<i class="icon-warning-sign icon-white" ng-show="machine.job.err"></i></div>'
        };
    });
}(window.JP.getModule('Machine')));