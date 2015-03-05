/**
 * AngularUI - The companion suite for AngularJS
 * @version v0.4.0 - 2013-04-09
 * @link http://angular-ui.github.com
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
angular.module("ui.config",[]).value("ui.config",{});
angular.module("ui.filters",["ui.config"]);
angular.module("ui.directives",["ui.config"]);
angular.module("ui",["ui.filters","ui.directives","ui.config"]);
angular.module("ui.directives").directive('uiSelect2', ['ui.config', '$timeout', 'Select2overlay', function (uiConfig, $timeout, Select2overlay) {
    var options = {};
    if (uiConfig) {
        angular.extend(options, uiConfig);
    }
    return {
        require: 'ngModel',
        priority: 1,
        compile: function (tElm, tAttrs) {
            var watch,
                repeatOption,
                repeatAttr,
                isSelect = tElm.is('select'),
                isMultiple = angular.isDefined(tAttrs.multiple);

            // Enable watching of the options dataset if in use
            if (tElm.is('select')) {
                repeatOption = tElm.find( 'optgroup[ng-repeat], optgroup[data-ng-repeat], option[ng-repeat], option[data-ng-repeat]');

                if (repeatOption.length) {
                    repeatAttr = repeatOption.attr('ng-repeat') || repeatOption.attr('data-ng-repeat');
                    watch = jQuery.trim(repeatAttr.split('|')[0]).split(' ').pop();
                }
            }

            return function (scope, elm, attrs, controller) {
                // instance-specific options
                var opts = angular.extend({}, options, scope.$eval(attrs.uiSelect2));

                /*
                 Convert from Select2 view-model to Angular view-model.
                 */
                var convertToAngularModel = function(select2_data) {
                    var model;
                    if (opts.simple_tags) {
                        model = [];
                        angular.forEach(select2_data, function(value, index) {
                            model.push(value.id);
                        });
                    } else {
                        model = select2_data;
                    }
                    return model;
                };

                /*
                 Convert from Angular view-model to Select2 view-model.
                 */
                var convertToSelect2Model = function(angular_data) {
                    var model = [];
                    if (!angular_data) {
                        return model;
                    }

                    if (opts.simple_tags) {
                        model = [];
                        angular.forEach(
                            angular_data,
                            function(value, index) {
                                model.push({'id': value, 'text': value});
                            });
                    } else {
                        model = angular_data;
                    }
                    return model;
                };

                if (isSelect) {
                    // Use <select multiple> instead
                    delete opts.multiple;
                    delete opts.initSelection;
                } else if (isMultiple) {
                    opts.multiple = true;
                }

                if (controller) {
                    // Watch the model for programmatic changes
                    scope.$watch(tAttrs.ngModel, function(current, old) {
                        if (!current) {
                            return;
                        }
                        if (current === old) {
                            return;
                        }
                        controller.$render();
                    }, true);
                    controller.$render = function () {
                        var openHandler = Select2overlay.openHandler;
                        var closeHandler = Select2overlay.closeHandler;
                        if (isSelect) {
                            elm.select2('val', controller.$viewValue).on('open', openHandler).on('close', closeHandler).on('opening', function () {this.focus();});
                        } else {
                            if (opts.multiple) {
                                elm.select2(
                                    'data', convertToSelect2Model(controller.$viewValue));
                            } else {
                                if (angular.isObject(controller.$viewValue)) {
                                    elm.select2('data', controller.$viewValue).on('open', openHandler).on('close', closeHandler).on('opening', function () {this.focus();});
                                } else if (!controller.$viewValue) {
                                    elm.select2('data', null).on('open', openHandler).on('close', closeHandler).on('opening', function () {this.focus();});
                                } else {
                                    elm.select2('val', controller.$viewValue).on('open', openHandler).on('close', closeHandler).on('opening', function () {this.focus();});
                                }
                            }
                        }
                    };

                    // Watch the options dataset for changes
                    if (watch) {
                        scope.$watch(watch, function (newVal, oldVal, scope) {
                            if (angular.equals(newVal, oldVal)) {
                                return;
                            }
                            // Delayed so that the options have time to be rendered
                            $timeout(function () {
                                elm.select2('val', controller.$viewValue);
                                // Refresh angular to remove the superfluous option
                                elm.trigger('change');
                                if(newVal && !oldVal && controller.$setPristine) {
                                    controller.$setPristine(true);
                                }
                            });
                        });
                    }

                    // Update valid and dirty statuses
                    controller.$parsers.push(function (value) {
                        var div = elm.prev();
                        div
                            .toggleClass('ng-invalid', !controller.$valid)
                            .toggleClass('ng-valid', controller.$valid)
                            .toggleClass('ng-invalid-required', !controller.$valid)
                            .toggleClass('ng-valid-required', controller.$valid)
                            .toggleClass('ng-dirty', controller.$dirty)
                            .toggleClass('ng-pristine', controller.$pristine);
                        return value;
                    });

                    if (!isSelect) {
                        // Set the view and model value and update the angular template manually for the ajax/multiple select2.
                        elm.bind("change", function () {
                            if (scope.$$phase || scope.$root.$$phase) {
                                return;
                            }
                            scope.$apply(function () {
                                controller.$setViewValue(
                                    convertToAngularModel(elm.select2('data')));
                            });
                        });

                        if (opts.initSelection) {
                            var initSelection = opts.initSelection;
                            opts.initSelection = function (element, callback) {
                                initSelection(element, function (value) {
                                    controller.$setViewValue(convertToAngularModel(value));
                                    callback(value);
                                });
                            };
                        }
                    }
                }

                elm.bind("$destroy", function() {
                    elm.select2("destroy");
                });

                attrs.$observe('disabled', function (value) {
                    elm.select2('enable', !value);
                });

                if (attrs.ngMultiple) {
                    scope.$watch(attrs.ngMultiple, function(newVal) {
                        attrs.$set('multiple', !!newVal);
                        elm.select2(opts);
                    });
                }

                // Initialize the plugin late so that the injected DOM does not disrupt the template compiler
                $timeout(function () {
                    elm.select2(opts);

                    // Set initial value - I'm not sure about this but it seems to need to be there
                    elm.val(controller.$viewValue);
                    // important!
                    controller.$render();

                    // Not sure if I should just check for !isSelect OR if I should check for 'tags' key
                    if (!opts.initSelection && !isSelect) {
                        controller.$setViewValue(
                            convertToAngularModel(elm.select2('data'))
                        );
                    }
                });
            };
        }
    };
}]);