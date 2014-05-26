'use strict';

(function (ng, app) {
    app.directive('multiSelect', ['$timeout', function ($timeout) {
        return {
            scope: {
                items: '=',
                selectedItems: '=',
                onItemSelect: '=',
                notifyDataSetChanged: '=',
                optionLabel: '='
            },
            restrict: 'EA',
            template: '<select data-ng-model="selectedItems" data-ng-options="item[optionLabel] for item in items"  multiple="multiple" id="{{id}}"></select>',
            link: function (scope, element, attrs) {
                scope.id = attrs.id + '-select';

                var striped = function () {
                    angular.element('.ms-selectable' + ' li:visible').filter(":even").addClass("striped");
                    angular.element('.ms-selectable' + ' li:visible').filter(":odd").removeClass("striped");
                    angular.element('.ms-selection' + ' li:visible').filter(":even").addClass("striped");
                    angular.element('.ms-selection' + ' li:visible').filter(":odd").removeClass("striped");
                };

                var initSelect = function initSelect() {
                    angular.element('#' + scope.id).multiSelect({
                        selectableHeader: '<div class="select-header">' + attrs.selectionHeader + '</div>',
                        selectionHeader: '<div class="select-header">' + attrs.selectedHeader + '</div>',
                        afterInit: function () {
                            $timeout(function () {
                                striped();
                            });
                        }
                    }).change(function () {
                        var size = scope.selectedItems.length;
                        scope.selectedItems.splice(0, size);
                        var val = angular.element('#' + scope.id).val() || [];
                        val.forEach(function (index) {
                            scope.selectedItems.push(scope.items[index]);
                        });
                        striped();
                        if (scope.onItemSelect) {
                            scope.onItemSelect();
                        }
                    });
                };
                scope.$watch('notifyDataSetChanged', function () {
                    if (typeof (scope.notifyDataSetChanged) === 'boolean') {
                        if (angular.element('#ms-' + scope.id).length) {
                            angular.element('#' + scope.id).multiSelect('refresh');
                        } else {
                            initSelect();
                        }
                    }
                });

                scope.$watch('items', function () {
                    if (scope.items && scope.items.length) {
                        $timeout(function () {
                            initSelect();
                        });
                    }

                });


            }
        };
    }]);
}(window.angular, window.JP.getModule('Rbac')));