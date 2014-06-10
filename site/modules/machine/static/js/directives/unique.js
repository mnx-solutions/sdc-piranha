'use strict';

(function (app) {
    app.directive('unique', [
        'Machine', 'Image',
        function (Machine, Image) {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    var type = scope.$eval(attrs.unique);
                    var items;
                    switch (type) {
                        case 'machine':
                            items = Machine.machine();
                            break;
                        default:
                            return;
                    }

                    ctrl.$parsers.unshift(function (viewValue) {
                        var isUnique = !items.some(function (e) { return e.name === viewValue; });
                        ctrl.$setValidity(type + 'Unique', isUnique);
                        return viewValue;
                    });
                }
            };
        }
    ]);
}(window.JP.getModule('Machine')));
