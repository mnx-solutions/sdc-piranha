'use strict';

(function (app) {
    app.directive('range',[
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        if ((viewValue.length > 0 && /^(\d+)$/i.test(viewValue))) {
                            var range = attrs.range.split('-');
                            var start = 0;
                            var end = 0;

                            if (range.length === 2) {
                                start = parseInt(range[0]);
                                end = parseInt(range[1]);
                            } else {
                                end = parseInt(range[0]);
                            }

                            if (viewValue >= start && viewValue <= end) {
                                ctrl.$setValidity('range', true);
                            } else {
                                ctrl.$setValidity('range', false);
                            }

                            return viewValue;
                        }

                        ctrl.$setValidity('range', false);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('firewall')));