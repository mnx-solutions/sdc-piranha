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
            template: '<span class="status btn btn-mini" ng-class="labelForState(machine.state)" ng-show="!machine.job || machine.job.finished">' +
                '{{machine.state}}</span>' +
                '<span class="status btn btn-mini" ng-show="machine.job && !machine.job.finished">' +
                '<img src="/static/img/ajax-loader.gif"/>' +
                '<span data-ng-show="machine.job.name == \'MachineStart\'" data-translate>Starting</span>' +
                '<span data-ng-show="machine.job.name == \'MachineStop\'" data-translate>Stopping</span>' +
                '<span data-ng-show="machine.job.name == \'MachineResize\'" data-translate>Resizing</span>' +
                '<span data-ng-show="machine.job.name == \'MachineReboot\'" data-translate>Rebooting</span>' +
                '<span data-ng-show="machine.job.name == \'MachineDelete\'" data-translate>Deleting</span>' +
                '</span>' +
                '<span class="status btn btn-mini" ng-show="machine.job.err"><i class="icon-warning-sign icon-white border"/>' +
                '</span>'
        };
    });
}(window.JP.getModule('Machine')));