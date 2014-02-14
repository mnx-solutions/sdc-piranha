'use strict';

(function (app) {
    app.directive('machineCollectionValue', [
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
                        // No invalid characters
                        if (/[^A-Z0-9\._\-]/i.test(viewValue)) {
                            ctrl.$setValidity('item', false);
                            return viewValue;
                        }

                        // Is unique key
                        var notUnique = $scope.collection.some(function (tag, index) {
                            if (tag.key === $scope.o.key && index !== $scope.key) {
                                return true;
                            }
                        });
                        if (notUnique) {
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