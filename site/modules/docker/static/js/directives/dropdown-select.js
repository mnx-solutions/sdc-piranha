'use strict';

(function (ng, app) {
    app.filter('getValue', function () {
        return function (item, row) {
            return row ? item[row] : item;
        };
    }).directive('dropdownSelect', [
        function () {
            return {
                restrict: 'EA',
                scope: {
                    items: '=?dropdownData',
                    selectedItems: '=?preselectedItems',
                    onFocus: '&'
                },
                templateUrl: 'docker/static/partials/dropdown-select.html',
                link: function (scope, element, attrs) {
                    scope.output = attrs.output || null;
                    scope.tags = attrs.hasOwnProperty('tagsAvailable');
                    scope.multiple = attrs.hasOwnProperty('multiple');
                    scope.volume = '';
                    scope.error = null;
                    scope.validation = attrs.validation;

                    var getVal = function (item) {
                        return attrs.result ? item[attrs.result] : item;
                    };
                    var items = scope.items;
                    scope.selectedItems = scope.selectedItems || (scope.multiple ? [] : (items && items.length ? getVal(items[0]) : ''));
                    scope.items = items || (scope.tags ? scope.selectedItems : []);

                    scope.filterSelected = function (item) {
                        return scope.selectedItems && scope.selectedItems.indexOf(getVal(item)) !== -1;
                    };

                    scope.filterUnSelected = function (item) {
                        return scope.selectedItems && scope.selectedItems.indexOf(getVal(item)) === -1;
                    };

                    scope.add = function () {
                        if (scope.error) {
                            return;
                        }
                        if (scope.volume.length && scope.selectedItems.indexOf(scope.volume) === -1) {
                            scope.selectVal(scope.volume);
                            scope.volume = '';
                        }
                        scope.setFocus = true;
                    };

                    scope.remove = function (item) {
                        var index = scope.selectedItems.indexOf(getVal(item));
                        if (index !== -1) {
                            scope.selectedItems.splice(index, 1);
                        }
                    };

                    scope.selectVal = function (item) {
                        if (scope.validation && !RegExp(scope.validation).test(getVal(item)) &&
                            !attrs.hasOwnProperty(attrs.itemsName)) {
                            return;
                        }

                        if (scope.multiple) {
                            scope.selectedItems.push(getVal(item));
                        } else {
                            scope.selectedItems = getVal(item);
                        }
                    };

                    scope.keydown = function (event) {
                        if (event.which === 13) {
                            scope.add();
                            event.preventDefault();
                        }
                    };

                    scope.change = function () {
                        var containerError = scope.$parent.containerCreateForm.$error;
                        var checkContainerErrors = function (itemName, errorName) {
                            var itemValue = scope.volume;
                            containerError[errorName] = false;
                            if (attrs.hasOwnProperty(itemName) && itemValue.length) {
                                itemValue = itemValue.split(':');
                                if (itemValue.length > 1) {
                                    itemValue = itemValue[0];
                                }
                            }
                            scope.error = containerError[errorName] = itemValue.length && !RegExp(scope.validation).test(itemValue);
                        };
                        if (scope.validation && attrs.itemsName && attrs.errorName) {
                            checkContainerErrors(attrs.itemsName, attrs.errorName);
                        }
                    };
                }
            };
        }]);
}(window.angular, window.JP.getModule('docker')));
