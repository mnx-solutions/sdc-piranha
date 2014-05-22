'use strict';

(function (ng, app) {
    app.directive('multiSelect', [function () {
        return {
            restrict: 'EA',
            scope: {
                selectedRoles: '='
            },
            link: function ($scope, $element, $attrs) {
                var striped = function () {
                    angular.element('.ms-selectable' + ' li:visible').filter(":even").addClass("striped");
                    angular.element('.ms-selectable' + ' li:visible').filter(":odd").removeClass("striped");
                    angular.element('.ms-selection' + ' li:visible').filter(":even").addClass("striped");
                    angular.element('.ms-selection' + ' li:visible').filter(":odd").removeClass("striped");
                };
                setTimeout(function () {
                    $element.multiSelect({
                        selectableHeader: '<div class="select-header">' + $attrs.selectionHeader + '</div>',
                        selectionHeader: '<div class="select-header">' + $attrs.selectedHeader + '</div>',
                        afterInit: function () {
                            setTimeout(function () {
                                striped();
                            }, 3000);
                        }
                    });
                });

                $element.change(function () {
                    $scope.selectedRoles = $element.val();
                    striped();
                });

            }
        };
    }]);
}(window.angular, window.JP.getModule('Rbac')));