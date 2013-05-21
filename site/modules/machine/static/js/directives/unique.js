'use strict';

(function (app) {
    app.directive('machineUnique',[
        'Machine',
        function (Machine) {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    var machines = Machine.machine();

                    ctrl.$parsers.unshift(function (viewValue) {
                        if (!machines.some(function (m) { return m.name === viewValue; })) {
                            ctrl.$setValidity('machineUnique', true);
                            return viewValue;
                        }

                        ctrl.$setValidity('machineUnique', false);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));