'use strict';

(function (app) {
    app.directive('machineCollectionItem', [
        function () {
            return {
                require: 'ngModel',
                link: function ($scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        // Not empty
                        if (!viewValue || viewValue.length === 0) {
                            // Both empty key and val are valid
                            ctrl.$setValidity('item', (!$scope.o.key || !$scope.o.val));
                            return viewValue;
                        }
                        // No invalid characters in key
                        if (attrs.placeholder === 'Key' && /[^A-Z0-9\._\-]/i.test(viewValue)) {
                            ctrl.$setValidity('item', false);
                            return viewValue;
                        }

                        ctrl.$setValidity('item', true);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));