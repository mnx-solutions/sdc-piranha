/*!
 * angular-advanced-searchbox
 * https://github.com/dnauck/angular-advanced-searchbox
 * Copyright (c) 2015 Nauck IT KG http://www.nauck-it.de/
 * Author: Daniel Nauck <d.nauck(at)nauck-it.de>
 * License: MIT
 */

(function() {

    'use strict';

    angular.module('angular-advanced-searchbox', ['ui.bootstrap.typeahead'])
        .directive('nitAdvancedSearchbox', function() {
            return {
                restrict: 'E',
                scope: {
                    model: '=ngModel',
                    parameters: '='
                },
                replace: true,
                templateUrl: '/static/partials/angular-advanced-searchbox.html',
                controller: [
                    '$scope', '$attrs', '$element', '$timeout', '$filter',
                    function ($scope, $attrs, $element, $timeout, $filter) {

                        $scope.placeholder = $attrs.placeholder || 'Search ...';
                        $scope.searchParams = [];
                        $scope.searchQuery = '';
                        $scope.setSearchFocus = false;
                        $scope.editSearchParam = false;
                        var isValueSelected = false;
                        $scope.searchValues = [];
                        $scope.$watch('searchQuery', function () {
                            updateModel();
                        });

                        var filterByKey = function (parameters, key) {
                            return $filter('filter')(parameters, function (param) {
                                return param.key === key;
                            })[0];
                        };

                        var removeDuplicates = function (labels) {
                            var keys = {};
                            labels.some(function (label, index) {
                                var key = label.key + label.value;
                                if (keys[key]) {
                                    $scope.removeSearchParam(index);
                                    return true;
                                }
                                keys[key] = true;
                            });
                        };

                        $scope.$watch('model', function (newValue, oldValue) {
                            if (angular.equals(newValue, oldValue)) {
                                return;
                            }
                            angular.forEach($scope.model, function (values, key) {
                                if (key === 'query' && $scope.searchQuery !== values) {
                                    $scope.searchQuery = values;
                                } else {
                                    var paramTemplate = filterByKey($scope.parameters, key);
                                    var searchParam = filterByKey($scope.searchParams, key);

                                    if (typeof paramTemplate !== 'undefined') {
                                        if (typeof searchParam === 'undefined') {
                                            values.forEach(function (value) {
                                                $scope.addSearchParam(paramTemplate, value, false);
                                            });
                                        }
                                    }
                                }
                            });
                            $scope.searchParams = $scope.searchParams.filter(function (param) {
                                return !$scope.model.hasOwnProperty(param.key) || $scope.model[param.key].indexOf(param.value) !== -1;
                            });
                        }, true);

                        $scope.$watch('searchParams', function () {
                            updateModel();
                        }, true);

                        $scope.enterEditMode = function(index) {
                            if (index === undefined) {
                                return;
                            }

                            var searchParam = $scope.searchParams[index];
                            $scope.editSearchParam = searchParam.editMode = true;
                        };

                        $scope.leaveEditMode = function (index) {
                            $timeout(function () {
                                $scope.editSearchParam = false;
                                if (typeof index === 'undefined') {
                                    return;
                                }

                                if (!isValueSelected) {
                                    var searchParam = $scope.searchParams[index];
                                    searchParam.editMode = false;
                                    removeDuplicates($scope.searchParams);
                                }
                            }, 100);
                        };

                        $scope.typeaheadOnSelectValue = function (item) {
                            $scope.editSearchParam = false;
                            isValueSelected = true;
                            removeDuplicates($scope.searchParams);
                            return item.name;
                        };

                        $scope.typeaheadOnSelect = function (item, model, label) {
                            $scope.addSearchParam(item);
                            $scope.searchQuery = '';
                        };

                        $scope.addSearchParam = function (searchParam, value, enterEditModel) {
                            if (enterEditModel === undefined) {
                                enterEditModel = true;
                            }
                            isValueSelected = false;

                            $scope.editSearchParam = enterEditModel;

                            $scope.searchParams.push(
                                {
                                    key: searchParam.key,
                                    name: searchParam.name,
                                    placeholder: searchParam.placeholder,
                                    value: value || undefined,
                                    values: searchParam.values,
                                    editMode: enterEditModel
                                }
                            );
                        };

                        $scope.removeSearchParam = function (index) {
                            $scope.editSearchParam = false;
                            if (index === undefined) {
                                return;
                            }

                            $scope.searchParams.splice(index, 1);

                            //TODO: show hidden/removed suggestion
                        };

                        $scope.removeAll = function() {
                            $scope.searchParams.length = 0;
                            $scope.searchQuery = '';

                            //TODO: show hidden/removed suggestion
                        };

                        $scope.editPrevious = function(currentIndex) {
                            if (currentIndex !== undefined) {
                                $scope.leaveEditMode(currentIndex);
                            }
                            //TODO: check if index == 0 -> what then?
                            if (currentIndex > 0) {
                                $scope.enterEditMode(currentIndex - 1);
                            } else if ($scope.searchParams.length > 0) {
                                $scope.enterEditMode($scope.searchParams.length - 1);
                            }
                        };

                        $scope.editNext = function(currentIndex) {
                            if (currentIndex === undefined) {
                                return;
                            }

                            $scope.leaveEditMode(currentIndex);

                            //TODO: check if index == array length - 1 -> what then?
                            if (currentIndex < $scope.searchParams.length - 1) {
                                $scope.enterEditMode(currentIndex + 1);
                            } else {
                                $scope.setSearchFocus = true;
                            }
                        };

                        $scope.keydown = function(e, searchParamIndex) {
                            var handledKeys = [];
                            if (handledKeys.indexOf(e.which) === -1) {
                                return;
                            }

                            var cursorPosition = getCurrentCaretPosition(e.target);

                            if (e.which == 8) { // backspace
                                if (cursorPosition === 0) {
                                    $scope.editPrevious(searchParamIndex);
                                }

                            } else if (e.which == 9) { // tab
                                if (e.shiftKey) {
                                    e.preventDefault();
                                    $scope.editPrevious(searchParamIndex);
                                } else {
                                    e.preventDefault();
                                    $scope.editNext(searchParamIndex);
                                }

                            } else if (e.which == 13) { // enter
                                $scope.editNext(searchParamIndex);

                            } else if (e.which == 37) { // left
                                if (cursorPosition === 0) {
                                    $scope.editPrevious(searchParamIndex);
                                }

                            } else if (e.which == 39) { // right
                                if (cursorPosition === e.target.value.length) {
                                    $scope.editNext(searchParamIndex);
                                }
                            }
                        };

                        function restoreModel() {
                            angular.forEach($scope.model, function (value, key) {
                                if (key === 'query') {
                                    $scope.searchQuery = value;
                                } else {
                                    var searchParam = $filter('filter')($scope.parameters, function (param) { return param.key === key; })[0];
                                    if (searchParam !== undefined) {
                                        $scope.addSearchParam(searchParam, value, false);
                                    }
                                }
                            });
                        }

                        if ($scope.model === undefined) {
                            $scope.model = {};
                        } else {
                            restoreModel();
                        }

                        var searchThrottleTimer;
                        function updateModel() {
                            if (searchThrottleTimer) {
                                $timeout.cancel(searchThrottleTimer);
                            }

                            searchThrottleTimer = $timeout(function () {
                                $scope.model = {};

                                if ($scope.searchQuery.length > 0) {
                                    $scope.model.query = $scope.searchQuery;
                                }

                                angular.forEach($scope.searchParams, function (param) {
                                    param.value = param.value || '';
                                    if (!$scope.model[param.key]) {
                                        $scope.model[param.key] = [param.value];
                                    } else if ($scope.model[param.key].indexOf(param.value) === -1) {
                                        $scope.model[param.key].push(param.value);
                                    }
                                });
                            }, 500);
                        }

                        function getCurrentCaretPosition(input) {
                            if (!input) {
                                return 0;
                            }

                            // Firefox & co
                            if (typeof input.selectionStart === 'number') {
                                return input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;

                            } else if (document.selection) { // IE
                                input.focus();
                                var selection = document.selection.createRange();
                                var selectionLength = document.selection.createRange().text.length;
                                selection.moveStart('character', -input.value.length);
                                return selection.text.length - selectionLength;
                            }

                            return 0;
                        }
                    }
                ]
            };
        })
        .directive('nitSetFocus', [
            '$timeout', '$parse',
            function($timeout, $parse) {
                return {
                    restrict: 'A',
                    link: function($scope, $element, $attrs) {
                        var model = $parse($attrs.nitSetFocus);
                        $scope.$watch(model, function(value) {
                            if (value === true) {
                                $timeout(function() {
                                    $element[0].focus();
                                });
                            }
                        });
                        $element.bind('blur', function() {
                            $scope.$apply(model.assign($scope, false));
                        });
                    }
                };
            }
        ])
        .directive('nitAutoSizeInput', [
            function() {
                return {
                    restrict: 'A',
                    scope: {
                        model: '=ngModel'
                    },
                    link: function($scope, $element, $attrs) {
                        var container = angular.element('<div style="position: fixed; top: -9999px; left: 0px;"></div>');
                        var shadow = angular.element('<span style="white-space:pre;"></span>');

/*
                        var maxWidth = $element.css('maxWidth') === 'none' ? $element.parent().innerWidth() : $element.css('maxWidth');
                        $element.css('maxWidth', maxWidth);
*/

                        angular.forEach([
                            'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
                            'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent',
                            'boxSizing', 'borderLeftWidth', 'borderRightWidth', 'borderLeftStyle', 'borderRightStyle',
                            'paddingLeft', 'paddingRight', 'marginLeft', 'marginRight'
                        ], function(css) {
                            shadow.css(css, $element.css(css));
                        });

                        angular.element('body').append(container.append(shadow));

                        function resize() {
                            shadow.text($element.val() || $element.attr('placeholder'));
                            $element.css('width', shadow.outerWidth() + 10);
                        }

                        resize();

                        if ($scope.model) {
                            $scope.$watch('model', function() { resize(); });
                        } else {
                            $element.on('keypress keyup keydown focus input propertychange change', function() { resize(); });
                        }
                    }
                };
            }
        ]);
})();
