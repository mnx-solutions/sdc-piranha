'use strict';

(function (app) {
    app.directive('machineName',['Machine', function(Machine) {
        return {
            require: 'ngModel',
            link: function(scope, elm, attrs, ctrl) {
                var machines = Machine.machine();

                ctrl.$parsers.unshift(function(viewValue) {
                    if (viewValue.length > 0 &&
                        /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/.test(viewValue)) {
                        if(!machines.some(function (m) { return m.name === viewValue; })) {
                            ctrl.$setValidity('machineName', true);
                            return viewValue;
                        }
                    }
                    ctrl.$setValidity('machineName', false);
                    return undefined;
                });
            }
        };
    }]);
}(window.JP.getModule('Machine')));