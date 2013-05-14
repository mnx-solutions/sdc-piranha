'use strict';

(function (app) {

    app.directive('machineStatus', function () {

        return {
            restrict: 'E',
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
            template: '<span class="status label label-info" ng-class="labelForState(machine.state)" ng-show="!machine.job || machine.job.finished">' +
                '{{machine.state}}</span>' +
                '<span class="loading-small" ng-show="machine.job && !machine.job.finished">' +
                // '<img src="/static/img/ajax-loader.gif"/>' +
                // '<span data-ng-show="machine.job.name == \'MachineCreate\'" data-translate></span>' +//Creating
                // '<span data-ng-show="machine.job.name == \'MachineStart\'" data-translate></span>' +//Starting
                // '<span data-ng-show="machine.job.name == \'MachineStop\'" data-translate></span>' +//Stopping
                // '<span data-ng-show="machine.job.name == \'MachineResize\'" data-translate></span>' +//Resizing
                // '<span data-ng-show="machine.job.name == \'MachineReboot\'" data-translate></span>' +//Rebooting
                // '<span data-ng-show="machine.job.name == \'MachineDelete\'" data-translate></span>' +//Deleting
                '</span>' +
				'<i class="icon-warning-sign icon-white" ng-show="machine.job.err"></i>'
                // '<span class="status label label-important" ng-show="machine.job.err"><i class="icon-warning-sign icon-white border"/>' +
                // '</span>'
        };
    });
}(window.JP.getModule('Machine')));