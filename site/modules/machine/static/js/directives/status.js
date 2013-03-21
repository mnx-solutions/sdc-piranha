'use strict';

(function (app) {

    app.directive('machineStatus', function () {

        return {
            restrict: "E",
            scope: {
                machine: "=machine"
            },
            link: function (scope) {
                scope.labelForState = function (state) {
                    switch (state) {
                        case "running":
                            return "label-success"
                        case "stopped":
                            return ""
                        default:
                            return "label-info"
                    }
                }
            },
            template: '<span class="label" ng-class="labelForState(machine.state)" ng-show="!machine.job.running && !machine.job.failed">' +
                '{{machine.state}}</span>' +
                '<span class="label label-info" ng-show="machine.job.running">' +
                '<img src="static/img/ajax-loader.gif"/>{{machine.job.name}}</span>' +
                '<span class="label label-inverse" ng-show="!machine.job.running && machine.job.failed"><i class="icon-warning-sign icon-white"/>' +
                '</span>'
        };
    });
}(window.JP.getModule('Machine')));