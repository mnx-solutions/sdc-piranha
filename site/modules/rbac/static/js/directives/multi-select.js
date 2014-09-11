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

                var makeZebraStriped = function () {
                    ng.element('.ms-selectable' + ' li:visible').filter(":even").addClass("striped");
                    ng.element('.ms-selectable' + ' li:visible').filter(":odd").removeClass("striped");
                    ng.element('.ms-selection' + ' li:visible').filter(":even").addClass("striped");
                    ng.element('.ms-selection' + ' li:visible').filter(":odd").removeClass("striped");
                };

                var initSelect = function initSelect() {
                    var initElement = ng.element('#' + scope.id);
                    initElement.multiSelect({
                        selectableHeader: '<div class="select-header">' + attrs.selectableHeader + '</div>',
                        selectionHeader: '<div class="select-header">' + attrs.selectionHeader + '</div>',
                        afterInit: function () {
                            $timeout(function () {
                                makeZebraStriped();
                            });
                        }
                    }).change(function () {
                        scope.selectedItems.splice(0, scope.selectedItems.length);
                        var val = initElement.val() || [];
                        val.forEach(function (index) {
                            scope.selectedItems.push(scope.items[index]);
                        });
                        makeZebraStriped();
                        if (scope.onItemSelect) {
                            scope.onItemSelect();
                        }
                    });
                };
                scope.$watch('notifyDataSetChanged', function () {
                    if (typeof (scope.notifyDataSetChanged) === 'boolean') {
                        if (ng.element('#ms-' + scope.id).length) {
                            // Removing not existing elements
                            scope.selectedItems.some(function (selectedItem, index) {
                                var existingElements = scope.items.filter(function (item) {
                                    return item.id === selectedItem.id;
                                });
                                var isSelectedExists = existingElements.length > 0;
                                if (!isSelectedExists) {
                                    scope.selectedItems.splice(index, 1);
                                }
                                return !isSelectedExists;
                            });
                            ng.element('#' + scope.id).multiSelect('refresh');
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
}(window.angular, window.JP.getModule('rbac')));