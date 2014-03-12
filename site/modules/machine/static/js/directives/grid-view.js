'use strict';

(function (ng, app) {
    app.controller('GridViewController', ['$scope', '$filter', '$http', '$location', function ($scope, $filter, $http, $location) {
        $scope.location = $location;
        $scope.getLastPage = function (update) {
            if ($scope.objects) {
                $scope.pageNumSum = $filter('filter')($scope.objects, $scope.matchesFilter).length;
                var lastPage =  Math.ceil($scope.pageNumSum / $scope.perPage);
                if (update && lastPage >= 0) {
                    $scope.lastPage = lastPage === 0 ? 1 : lastPage;
                }

                return lastPage;

            }
        };

        $scope.$watch('objects + props + perPage + filterAll', $scope.getLastPage.bind($scope, true), true);

        $scope.calcPageLimits = function calcPageLimits() {
            $scope.pageNumFirst = ($scope.page - 1) * $scope.perPage + 1;
            $scope.pageNumLast = Math.min($scope.page * $scope.perPage, $scope.pageNumSum);
        };

        $scope.$watch('page', $scope.calcPageLimits);
        $scope.$watch('perPage', $scope.calcPageLimits);
        $scope.$watch('pageNumSum', $scope.calcPageLimits);
        var rightMargin = 100;
        var rightMarginDetails = 15;
        var gridWidthFullPage = 1000;
        var gridWidthDetails = 500;

        function calcWidth() {
            var gridWidth = 0;
            var bodyWidth = ng.element('body').width();
            var leftMenuWidth = ng.element('.page-sidebar').width();
            var analyticsWidth = ng.element('.right-part').width();
            var rightSpacerWidth = ng.element('.right-spacer').width();

            if ($scope.specialWidth && $scope.specialWidth === "detailsPage") {
                gridWidth = bodyWidth - leftMenuWidth - analyticsWidth - rightSpacerWidth - rightMargin - rightMarginDetails;
                if (gridWidth < gridWidthDetails) {
                    gridWidth = gridWidthDetails;
                }
            } else {
                gridWidth = bodyWidth - leftMenuWidth - rightMargin;
                if (gridWidth < gridWidthFullPage) {
                    gridWidth = gridWidthFullPage;
                }
            }
            ng.element('.item-list-container').width(gridWidth);
        }

        ng.element('.sidebar-toggler').on('click', calcWidth);
        window.onresize = calcWidth;
        calcWidth();

        $scope.getLastPage(true);
        $scope.calcPageLimits();

        $scope.isOnPage = function (index) {
            return (index >= $scope.perPage * ($scope.page - 1)) && (index < ($scope.perPage * $scope.page));
        };

        $scope.showAll = function () {
            $scope.perPage = 10000;
        };

        $scope.openDetails = {};

        $scope.toggleDetails = function (id) {
            $scope.openDetails[id] = !$scope.openDetails[id];
        };

        $scope.areDetailsShown = function (id) {
            return $scope.openDetails[id];
        };

        $scope.clearOrder = function () {
            $scope.order = [];
        };

        $scope.orderGridMachinesBy = function (prop, reverse) {
            if ($scope.multisort !== 'false') {
                var existed = null;
                if ($scope.order.indexOf(prop.order) !== -1) {
                    existed = 'order';
                    delete $scope.order[$scope.order.indexOf(prop.order)];
                }
                if ($scope.order.indexOf(prop.rorder) !== -1) {
                    existed = 'rorder';
                    delete $scope.order[$scope.order.indexOf(prop.rorder)];
                }
                if (reverse === undefined) {
                    if (!existed) {
                        $scope.order.push(prop.order);
                    } else if (existed === 'order') {
                        $scope.order.push(prop.rorder);
                    }
                } else if ((reverse && existed !== 'rorder') || (!reverse && existed !== 'order')) {
                    $scope.order.push(reverse ? prop.rorder : prop.order);
                }
            } else {
                var order = $scope.order[0];

                if (order === prop.order) {
                    $scope.order = [prop.rorder];
                } else {
                    $scope.order = [prop.order];
                }
            }

            $scope.props.forEach(function (el) {
                if (el.name === prop.name) {
                    el.columnActive = true;
                } else {
                    el.columnActive = false;
                }
            });

            if ($scope.userConfig._loaded) {
                var userConfig = $scope.gridUserConfig.config;
                userConfig.order = {name: prop.name, ord: $scope.order[0] === prop.order};
                userConfig.dirty(true);
                userConfig.$save();
            }
        };

        $scope.matchesFilter = function (obj) {
            if ($scope.filterAll) {
                return $scope.props.some(function (el) {
                    if (!el.active) {
                        return false;
                    }

                    var subject = (el._getter && el._getter(obj)) || (el.id2 && obj[el.id][el.id2]) || obj[el.id] || '';

                    if (ng.isNumber(subject) || typeof subject === "boolean") {
                        subject = subject.toString();
                    }

                    if (ng.isObject(subject) || ng.isArray(subject)) {
                        subject = JSON.stringify(subject);
                    }

                    var needle = $scope.filterAll.toLowerCase();

                    return (subject.toLowerCase().indexOf(needle) !== -1);
                });
            }

            return true;
        };

        $scope.changePage = function (t) {
            $scope.page = t;
        };

        $scope.showProps = function () {
            $scope.propOn = !$scope.propOn;
        };
        function getJSONData() {
            var filtered = $filter('filter')($scope.objects, $scope.matchesFilter);
            var ordered = $filter('orderBy')(filtered, $scope.order);

            // List all the different properties from all objects
            var order = [];
            $scope.objects.forEach(function (object) {
                Object.keys(object).forEach(function (property) {
                    if (property.indexOf('$$') !== 0 && order.indexOf(property) === -1) {
                        order.push(property);
                    }
                });
            });

            var final = [];
            if ($scope.exportFields.ignore) {
                order = order.filter(function (k) { return $scope.exportFields.ignore.indexOf(k) === -1; });
            }
            if ($scope.exportFields.fields) {
                order = order.filter(function (k) { return $scope.exportFields.ignore.indexOf(k) !== -1; });
            }

            ordered.forEach(function (el) {
                var obj = {};
                order.forEach(function (id) {
                    obj[id] = el[id] !== undefined ? el[id] : '';
                });
                final.push(obj);
            });

            return {
                data: final,
                order: order
            };
        }

        $scope.export = function (format) {
            $http.post('machine/export', getJSONData())
                .success(function (id) {
                    $scope.iframe = '<iframe src="machine/export/' + id + '/' + format + '/' + $scope.objectsType + '"></iframe>';
                })
                .error(function () {
                    console.log('err', arguments);
                });
        };

        $scope.getActionButtons = function (object) {
            if (!object) {
                return $scope.actionButtons;
            }
            if (!$scope.actionButtons) {
                return [];
            }

            return $scope.actionButtons.filter(function (btn) {
                if (btn.show === undefined) {
                    return true;
                }
                if (typeof btn.show === 'function') {
                    return btn.show(object);
                }

                return !!btn.show;
            });
        };


        $scope.selectAllCheckbox = function () {
            if ($scope.checkedCheckBoxDisable) {return; }
            $scope.checkedCheckBox = !$scope.checkedCheckBox;
            $scope.objects.forEach(function (el) {
                el.checked = false;
            });
            var objects = $filter('filter')($scope.objects, $scope.matchesFilter);
            objects.forEach(function (el) {
                el.checked = $scope.checkedCheckBox;
            });
        };

        $scope.disableSelectAllCheckbox = function () {
            $scope.checkedCheckBoxDisable = $scope.objects.some(function (el) {
                return (el.fireWallActionRunning) || (el.job && !el.job.finished);
            });
        };

        $scope.$watch('objects', function (objects) {
            if (objects) {
                $scope.selectCheckbox();
                $scope.disableSelectAllCheckbox();
            }
        }, true);

        $scope.selectCheckbox = function (obj) {
            var id = obj && (obj.id || obj.uuid);

            var selectedItemsCount = 0;
            var objects = $filter('filter')($scope.objects, $scope.matchesFilter);
            $scope.objects.forEach(function (el) {
                if (objects.indexOf(el) === -1) {
                    el.checked = false;
                    return;
                }

                var objId = el.id || el.uuid;
                if (objId === id && !el.fireWallActionRunning && (!el.job || el.job.finished)) {
                    el.checked = !el.checked;
                }
                if (el.checked) {
                    selectedItemsCount += 1;
                }
            });

            $scope.checkedCheckBox = objects.length && selectedItemsCount === objects.length;
        };
        $scope.selectColumnsCheckbox = function (id) {
            $scope.props.forEach(function (el) {
                if (el.id === id) {
                    el.active = (el.active) ? false : true;
                    if ($scope.userConfig._loaded) {
                        $scope.gridUserConfig.propKeys[id].active = el.active;
                        $scope.gridUserConfig.config.dirty(true);
                    }
                }
            });
            $scope.userConfig.$save();
        };

        $scope.noClose = function () {
            ng.element('.dropdown-menu').click(function (event) {
                event.stopPropagation();
            });
        };

        $scope.selectCheckbox();

    }]).constant('gridConfig', {
        paginated: true,
        perPage: 25,
        page: 1,
        showPages: 5,
        order: [],
        propOn: false,
        multisort: true,
        controls: true
    })
    .directive('gridView', ['gridConfig', '$rootScope', function (gridConfig, $rootScope) {
        return {
            restrict: 'EA',
            scope: {
                order: '=',
                props: '=',
                detailProps: '=',
                objects: '=',
                actionButtons:'=',
                imageButtonShow:"=",
                filterAll: '@',
                exportFields: '=',
                columnsButton: '=',
                actionsButton: '=',
                specialWidth: '=',
                //TODO: What are these forms?
                searchForm: '=',
                instForm: '=',
                imgForm: '=',
                enabledCheckboxes: '=',
                objectsType: '@',
                placeHolderText: '=',
                multisort: '@',
                userConfig: '='
            },
            controller: 'GridViewController',
            templateUrl: 'machine/static/partials/grid-view.html',
            replace: true,
            link: function($scope, element, attrs) {
                $scope.paginated = ng.isDefined(attrs.paginated) ? $scope.$eval(attrs.paginated) : gridConfig.paginated;
                $scope.perPage = ng.isDefined(attrs.perPage) ? $scope.$eval(attrs.perPage) : gridConfig.perPage;
                $scope.showPages = ng.isDefined(attrs.showPages) ? $scope.$eval(attrs.showPages) : gridConfig.showPages;
                $scope.page = $scope.page || gridConfig.page;
                $scope.order = $scope.order || gridConfig.order;
                $scope.propOn = ng.isDefined(attrs.propOn) ? $scope.$eval(attrs.propOn) : gridConfig.propOn;
                $scope.multisort = ng.isDefined(attrs.multisort) ? $scope.$eval(attrs.multisort) : gridConfig.multisort;
                $scope.controls = ng.isDefined(attrs.controls) ? $scope.$eval(attrs.controls) : gridConfig.controls;

                $scope.props.forEach(function (el) {

                    if ($rootScope.features.firewall === 'enabled') {
                        if (el.id === 'firewall_enabled') {
                            el.active = true;
                        }
                        if (el.id === 'updated') {
                            el.active = false;
                        }
                    }

                    if (el._getter) {
                        el.order = el._getter;
                        el.rorder = function (obj) {
                            var elem = String(el._getter(obj));
                            var next = '';
                            var i;
                            for (i = 0; i < elem.length; i += 1) {
                                next += String.fromCharCode(255 - elem.charCodeAt(i));
                            }
                            return next;
                        };
                    } else if (!el.id2) {
                        if (el.reverseSort) {
                            el.rorder = el.id;
                            el.order = '-' + el.id;
                        } else {
                            el.order = el.id;
                            el.rorder = '-' + el.id;
                        }
                    } else {
                        el.order = el.id + '.' + el.id2;
                        el.rorder = '-' + el.id + '.' + el.id2;
                    }

                });

                if (!$scope.userConfig) {
                    $scope.userConfig = {
                        $load: function (callback) { this._loaded = true;callback(null, $scope.userConfig); },
                        $save: function () {},
                        $child: function () { return $scope.userConfig; },
                        dirty: function () {},
                        _loaded: false
                    };
                }

                $scope.userConfig.$load(function (error, config) {
                    if (error) {
                        return;
                    }
                    var propKeys = {};
                    $scope.gridUserConfig = {
                        config: config,
                        propKeys: propKeys
                    };

                    if (Array.isArray(config.props)) {
                        config.props.forEach(function (prop) {
                            propKeys[prop.id] = prop;
                        });
                    } else {
                        config.props = [];
                        config.dirty(true);
                    }

                    if ($scope.paginated) {
                        if (!ng.isDefined(config.perPage)) {
                            config.perPage = $scope.perPage;
                            config.dirty(true);
                        } else {
                            $scope.perPage = config.perPage;
                        }
                    } else {
                        $scope.showAll();
                    }

                    $scope.$watch('perPage', function (num) {
                        if (ng.isDefined(num) && $scope.paginated) {
                            config.perPage = $scope.perPage;
                            config.dirty(true);
                            config.$save();
                        }
                    });
                    $scope.props.forEach(function (el) {
                        if (propKeys[el.id]) {
                            el.active = propKeys[el.id].active;
                            if (!el.id2) {
                                if (propKeys[el.id].order) {
                                    el.order = propKeys[el.id].order;
                                }
                                if (propKeys[el.id].reorder) {
                                    el.reorder = propKeys[el.id].reorder;
                                }
                            }
                        } else {
                            propKeys[el.id] = el;
                            config.props.push(el);
                            config.dirty(true);
                        }

                        if (!ng.isDefined(config.order)) {
                            config.dirty(true);
                            config.order = $scope.order;
                        } else if (el.name === config.order.name) {
                            $scope.order = [config.order.ord ? el.order : el.rorder];
                        }
                    });
                    config.$save();
                });
            }
        };
    }])
    .filter('jsonArray', function () {
        return function (array) {
            if (ng.isArray(array)) {
                return array.join('; ');
            }
            return JSON.parse(array).join('; ');
        };
    });
}(window.angular, window.JP.getModule('Machine')));

