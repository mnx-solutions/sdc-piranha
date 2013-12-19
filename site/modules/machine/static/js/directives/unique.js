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
        }
    ]).directive('imageUnique', [
        'Image',
        function (Image) {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    var images = Image.image();

                    ctrl.$parsers.unshift(function (viewValue) {
                        if (!images.some(function (m) { return m.name === viewValue; })) {
                            ctrl.$setValidity('imageUnique', true);
                            return viewValue;
                        }

                        ctrl.$setValidity('imageUnique', false);
                        return viewValue;
                    });
                }
            };
        }
    ]);
}(window.JP.getModule('Machine')));