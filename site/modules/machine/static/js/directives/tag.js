'use strict';

(function (app) {
    app.directive('tag',[
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        if ((viewValue && viewValue.length > 0)) {
                            if (!/^[A-Z0-9\._-]*$/i.test(viewValue)) {
                                ctrl.$setValidity('tag', false);
                            } else {
                                ctrl.$setValidity('tag', true);
                            }
                        } else {
                            ctrl.$setValidity('tag', false);
                        }


                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));