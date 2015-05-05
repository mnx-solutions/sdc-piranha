'use strict';

/*
  * taken from https://github.com/itslenny/angular-slidezilla/blob/master/src/angular-slidezilla.js
  * modified a template and init data
 */

(function (ng, app) {
    app.directive('slider', function () {
        return {
            scope: {
                model: '=ngModel',
                measure: '@?',
                min: '@?',
                max: '@?'
            },
            restrict: 'E',
            require: ['ngModel'],
            link: function (scope, element, attrs, ctrls) {
                // process attributes and watch for changes
                scope.min = parseInt(scope.min, 10) || 0;
                scope.max = parseInt(scope.max, 10) || 100;
                scope.step = parseInt(attrs.step, 10) || 5;
                scope.showLimit = attrs.hasOwnProperty('showLimit');
                scope.showValue = attrs.hasOwnProperty('showValue');

                // init dom objects
                var handles = element[0].querySelectorAll('.slider-handle');
                var track = element[0].querySelector('.slider-track');
                var selection = element[0].querySelector('.slider-selection');

                // drag state variable
                var dragging = false;
                var lastDragging = false;

                // model -> UI ////////////////////////////////////
                ctrls[0].$render = function () {
                    var hPos1, hPos2;
                    //ensure model value is in range
                    clampModelValue();
                    //update view value
                    ctrls[0].$setViewValue(scope.model);
                    //update display to match model value
                    if (typeof scope.model === 'number') { // 25/75 = x / 100
                        hPos1 = 0;
                        hPos2 = 100 / (scope.max - scope.min) * (scope.model - scope.max) + 100;
                        ng.element(handles[0]).css('margin-left', hPos2 + '%');
                        ng.element(handles[1]).addClass('hidden');
                    } else {
                        hPos1 = 100 / (scope.max - scope.min) * (scope.model[0] - scope.max) + 100;
                        hPos2 = 100 / (scope.max - scope.min) * (scope.model[1] - scope.max) + 100;
                        ng.element(handles[0]).css('margin-left', hPos1 + '%');
                        ng.element(handles[1]).css('margin-left', hPos2 + '%').removeClass('hidden');
                    }
                    ng.element(selection).css('margin-left', hPos1 + '%').css('width', (hPos2 - hPos1 + 1) + '%');
                };

                // ui->model ////////////////////////////////////

                // bind mouse down event (track) - increment by step
                ng.element(track).bind('mousedown', function (e) {
                    e.preventDefault();
                    if (dragging) {
                        return;
                    }
                    var newVal = scope.model;
                    var offsetX = e.offsetX || e.layerX;

                    if (typeof newVal === 'number') {
                        if (offsetX > handles[0].offsetLeft) {
                            newVal += scope.step;
                        } else {
                            newVal -= scope.step;
                        }
                    } else {
                        if (e.target === track && offsetX < handles[0].offsetLeft) {
                            newVal[0] -= scope.step;
                        } else if (e.target == track && offsetX > handles[1].offsetLeft) {
                            newVal[1] += scope.step;
                        } else {
                            if (e.target === selection && offsetX > e.target.offsetWidth / 2) {
                                newVal[1] -= scope.step;
                            } else {
                                newVal[0] += scope.step;
                            }
                        }
                    }
                    scope.$apply(function () {
                        scope.model = newVal;
                        ctrls[0].$render();
                    });
                });

                // Bind mousedown event (drag handles) -- start drag
                ng.element(handles).bind('mousedown', function (e) {
                    e.preventDefault();
                    // store data about currently dragging handle
                    dragging = {
                        sx: e.clientX - e.target.offsetLeft,
                        sy: e.clientY - e.target.offsetTop,
                        w: e.target.offsetWidth,
                        h: e.target.offsetHeight,
                        element: e.target,
                        index: e.target == handles[0] ? 0 : 1,
                        container: e.target.parentElement.getBoundingClientRect()
                    };

                    // listen for movement / mouse up
                    ng.element(document).bind('mousemove', mousemove);
                    ng.element(document).bind('mouseup', mouseup);
                });

                function updateValue (dragging, apply) {
                    // compute slider value based on handle position
                    var percentVal = dragging ? Math.max(0, Math.min(100, parseInt((dragging.x / (dragging.container.right - dragging.container.left)) * 100))) : 0;
                    var max = parseFloat(scope.max);
                    var min = parseFloat(scope.min);
                    var normalizedVal = ((percentVal / 100) * (max - min)) + min;
                    normalizedVal = parseFloat(normalizedVal.toFixed(3));
                    var rounded = roundToStep(normalizedVal, scope.step);
                    // pass value to model
                    var setMVal = scope.model;
                    if (typeof setMVal === 'number') {
                        setMVal = rounded;
                    } else {
                        setMVal[dragging.index] = rounded;
                    }
                    if (apply) {
                        scope.$apply(function () {
                            scope.model = setMVal;
                            ctrls[0].$render();
                        });
                    } else {
                        scope.model = setMVal;
                    }
                }

                // mousemove event (document) -- update drag handle to position
                function mousemove(e) {
                    if (!dragging) return;
                    dragging.y = e.clientY - dragging.sy;
                    dragging.x = e.clientX - dragging.sx;
                    //contain drag within track
                    if (dragging.x < 0) {
                        dragging.x = 0;
                    } else if (dragging.x > dragging.container.right - dragging.container.left) {
                        dragging.x = dragging.container.right - dragging.container.left;
                    }
                    lastDragging = dragging;

                    updateValue(dragging, true);
                }

                // mouse up event (document) -- stop drag
                function mouseup (e) {
                    ng.element(document).unbind('mousemove', mousemove);
                    ng.element(document).unbind('mouseup', mouseup);
                    dragging = false;
                }

                // update value when range changing
                var attempt = 0;
                scope.$watch('min + max', function () {
                    // update only after initializing
                    if (attempt > 2) {
                        updateValue(lastDragging, false);
                    }
                    attempt = attempt + 1;
                });


                //// helpers ////////////////////////////////////
                //rounds value to step
                function roundToStep(val, step) {
                    return (val >= 0 ) ? val + step / 2 - (val + step / 2) % step : val - step / 2 - (val + step / 2) % step;
                }

                //clamps model values. Keeps sliders within track and keeps them in index order
                function clampModelValue() {
                    if (typeof scope.model === 'number') {
                        if (scope.model > scope.max) {
                            scope.model = scope.max;
                        } else if (scope.model < scope.min) {
                            scope.model = scope.min;
                        }
                    } else {
                        var cv0, cv1;
                        if (scope.model[0] > scope.model[1]) {
                            cv1 = scope.model[0];
                            cv0 = scope.model[1];
                            scope.model[0] = cv0;
                            scope.model[1] = cv1;
                        }
                        if (scope.model[0] > scope.max) {
                            cv0 = scope.max;
                        } else if (scope.model[0] < scope.min) {
                            cv0 = scope.min;
                        }
                        if (scope.model[1] > scope.max) {
                            cv1 = scope.max;
                        } else if (scope.model[1] < scope.min) {
                            cv1 = scope.min;
                        }
                        if (cv0 || cv1) {
                            scope.model = [cv0 || scope.model[0], cv1 || scope.model[1]];
                        }
                    }
                }
            },
            template: '<div class="slider slider-horizontal">' +
                        '<div class="slider-track" ng-class="{\'show-value\': showValue}">' +
                        '<div class="limit low" data-ng-show="showLimit">{{min}}</div>' +
                        '<div class="slider-selection"></div>' +
                        '<div class="slider-handle round"></div>' +
                        '<div class="slider-handle round"></div>' +
                        '<div class="limit high" data-ng-show="showLimit">{{max}}</div>' +
                        '</div>' +
                        '<div class="current-value" data-ng-show="showValue">{{model}}{{measure}}</div>' +
                    '</div>',
            replace: true
        };
    });
}(window.angular, window.JP.getModule('docker')));
