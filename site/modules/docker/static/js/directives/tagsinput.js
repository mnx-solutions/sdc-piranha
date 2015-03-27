'use strict';

(function (ng, app) {
    app.filter('getCol', function () {
        return function (items) {
            return items ? items.join(',') : [];
        };
    }).directive('focusMe', ['$timeout', '$parse', function ($timeout, $parse) {
        return {
            link: function (scope, element, attrs) {
                var model = $parse(attrs.focusMe);
                scope.$watch(model, function (value) {
                    if (value === true) {
                        $timeout(function () {
                            element[0].focus();
                        });
                    }
                });
                element.bind('blur', function () {
                    scope.$apply(model.assign(scope, false));
                });
            }
        };
    }]).directive('tagsInput', function () {
        return {
            restrict: 'AE',
            require: 'ngModel',
            scope: {
                tags: '=ngModel',
                onFocusFn: '&'
            },
            replace: true,
            templateUrl: 'docker/static/partials/tags-input.html',
            link: function ($scope, $element, $attrs, $ctrl) {

                $scope.placeholder = $attrs.placeholder || '';
                $scope.item = '';
                $scope.tags = $scope.tags || [];
                $scope.error = false;
                var regexp = $attrs.regexpValidate ? new RegExp($attrs.regexpValidate, 'i') : null;

                $scope.add = function (name) {
                    if ($scope.tags.indexOf(name) === -1 && !$scope.error) {
                        $scope.tags.push(name);
                        $scope.item = '';
                    }
                };

                $scope.remove = function (index) {
                    $scope.tags.splice(index, 1);
                };

                $scope.edit = function (index) {
                    $scope.item = $scope.tags.splice(index, 1);
                };

                $scope.onFocus = function () {
                    $scope.focus = true;
                    $scope.onFocusFn();
                };

                $scope.onBlur = function () {
                    $scope.focus = false;
                    if ($scope.item.length) {
                        $scope.add($scope.item);
                    }
                };

                $scope.keydown = function (e) {
                    var keys = [8, 13];
                    if (keys.indexOf(e.which) !== -1) {
                        if (e.which === 8) { /* backspace */
                            if ($scope.item.length === 0 && $scope.tags.length) {
                                $scope.tags.pop();
                                e.preventDefault();
                            }
                        } else if (e.which === 13) { /* enter */
                            if ($scope.item.length) {
                                $scope.add($scope.item);
                                e.preventDefault();
                            }
                        }
                    }
                };

                $scope.change = function () {
                    if (regexp) {
                        $scope.error = $scope.item.length && !regexp.test($scope.item);
                        $ctrl.$setValidity('pattern', !$scope.error);
                    }
                };
            }
        };
    });
}(window.angular, window.JP.getModule('docker')));