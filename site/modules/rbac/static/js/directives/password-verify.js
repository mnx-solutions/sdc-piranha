'use strict';

(function (app) {
    app.directive('passwordVerify', ['$timeout',
        function ($timeout) {
            return {
                require: 'ngModel',
                link: function (scope, element, attrs, ctrl) {
                    var firstPassword = '#' + attrs.passwordVerify;
                    $timeout(function () {
                        element.add(firstPassword).on('keyup', function () {
                            scope.$apply(function () {
                                var v = element.val() === angular.element(firstPassword).val();
                                if (element.val() !== "") {
                                    ctrl.$setValidity('passwordVerify', v);
                                }
                            });
                        });
                    });
                }
            };
        }]);
}(window.JP.getModule('rbac')));