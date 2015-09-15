'use strict';

(function (app) {
    app.directive('ip',[
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    var pattern = '^((\\d{1,3}\\.){3}\\d{1,3})';
                    if (attrs.hasOwnProperty('onlySubnet')) {
                        pattern += '\/(\\d|[1-2]\\d|3[0-2])';
                    } else if (attrs.hasOwnProperty('orSubnet')) {
                        pattern += '(\/(\\d|[1-2]\\d|3[0-2]))?';
                    }
                    pattern += '$';
                    var regexp = new RegExp(pattern, 'i');
                    ctrl.$parsers.unshift(function (viewValue) {
                        if (!viewValue || viewValue.length < 1) {
                            ctrl.$setValidity((elm[0].form || elm[0]).name, attrs.hasOwnProperty('required') ? false : true);
                        } else if (regexp.test(viewValue)) {
                            ctrl.$setValidity((elm[0].form || elm[0]).name, true);
                        } else {
                            ctrl.$setValidity((elm[0].form || elm[0]).name, false);
                        }

                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('firewall')));