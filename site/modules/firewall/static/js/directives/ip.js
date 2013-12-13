'use strict';

(function (app) {
    app.directive('ip',[
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {

                    ctrl.$parsers.unshift(function (viewValue) {
                        if (!viewValue || viewValue.length < 1) {
                            ctrl.$setValidity((elm[0].form || elm[0]).name, false);
                        } else if (/^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})$/i.test(viewValue)) {
                            ctrl.$setValidity((elm[0].form || elm[0]).name, true);
                        }

                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('firewall')));