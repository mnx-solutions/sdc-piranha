'use strict';

(function (app) {
    app.directive('machineName',[
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {

                    elm.on('focus', function () {
                        scope.changingName = true;
                    });

                    elm.on('blur', function () {
                        scope.changingName = false;
                    });

                    ctrl.$parsers.unshift(function (viewValue) {
                        if (viewValue.length > 0 && !/^([a-z0-9\.-]*)$/i.test(viewValue)) {
                            ctrl.$setValidity('machineName', false);
                            return viewValue;
                        }

                        ctrl.$setValidity('machineName', true);
                        return viewValue;

                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));