'use strict';

(function (ng, app) {
    app.controller('GridViewController', ['$scope', '$filter', '$http', '$location', 'Account', '$rootScope', 'Datacenter', '$qe', function ($scope, $filter, $http, $location, Account, $rootScope, Datacenter, $qe) {
        $scope.location = $location;

        function refreshGrid() {
            $scope.refreshPager();
            var filteredItems = $filter('filter')($scope.items, $scope.matchesFilter);
            var orderedItems = $filter('orderBy')(filteredItems, $scope.order);
            $scope.pagedItems = orderedItems && orderedItems.filter(function (item, index) {
                return $scope.isOnPage(index);
            });
            $scope.checkedAllCheckBox = areAllPagedItemsChecked();
        }

        $scope.$watch('pagedItems', function (items) {
            var asyncProps = $scope.props.filter(function (prop) {
                return prop.type === 'async';
            });

            if (items && items.length && asyncProps.length) {
                var iterator = function (item, callback) {
                    asyncProps.forEach(function (prop) {
                        $qe.when(prop._getter(item)).then(function (result) {
                            item[prop.name + 'async'] = result;
                            callback();
                        });
                    });
                };
                $qe.eachLimit(items, 25, iterator);
            }
        });

        function areAllPagedItemsChecked() {
            if ($scope.pagedItems && $scope.pagedItems.length) {
                return $scope.pagedItems.every(function (item) {
                    return item.checked;
                });
            }
            return false;
        }

        $scope.isOnPage = function (index) {
            return (index >= $scope.perPage * ($scope.page - 1)) && (index < ($scope.perPage * $scope.page));
        };

        $scope.refreshPager = function () {
            if ($scope.items) {
                $scope.pageNumSum = $filter('filter')($scope.items, $scope.matchesFilter).length;
                var lastPage = Math.ceil($scope.pageNumSum / $scope.perPage);
                if (lastPage >= 0) {
                    $scope.lastPage = lastPage === 0 ? 1 : lastPage;
                }
                $scope.pageNumFirst = ($scope.page - 1) * $scope.perPage + 1;
                $scope.pageNumLast = Math.min($scope.page * $scope.perPage, $scope.pageNumSum);
            }
        };

        $scope.tabFilter = '';

        if ($scope.tabFilterField) {
            var setCurrentTabFilter = function () {
                $scope.tabFilter = $scope.tabFilterDefault || $scope.tabFilter || $scope.tabFilters.slice(-1)[0];
            };

            var tabFilterUserConfig = null;
            if ($rootScope.features.manta === 'enabled') {
                tabFilterUserConfig = Account.getUserConfig().$child($scope.tabFilterField);
            }

            var loadCurrentTabFilter = function () {
                if (tabFilterUserConfig) {
                    tabFilterUserConfig.$load(function (error, config) {
                        $scope.tabFilter = config.value;
                        setCurrentTabFilter();

                        $scope.$watch('tabFilter', function (filter) {
                            if (filter) {
                                config.value = filter;
                                config.dirty(true);
                                config.$save();
                            }
                        });
                    });
                } else {
                    setCurrentTabFilter();
                }
            };

            if ($scope.tabFilterField === 'datacenter') {
                Datacenter.datacenter().then(function (datacenters) {
                    $scope.tabFilters = datacenters.map(function (datacenter) {
                        return datacenter.name;
                    });
                    $scope.tabFilters.push('all');
                    loadCurrentTabFilter();
                });
            } else {
                $scope.tabFilters = ['all'];
                loadCurrentTabFilter();
            }
        }

        $scope.$watch('props + page + order + filterAll + tabFilter + perPage', refreshGrid, true);

        $scope.$watch('tabFilter', function() {
            if ($scope.tabFilter && $scope.tabFilter.length > 0 || $scope.tabFilterField !== 'datacenter') {
                $scope.loading = false;
            }
            if ($scope.tabFilterUpdate) {
                $scope.tabFilterUpdate = $scope.tabFilter;
            }
        });

        $scope.$watch('tabFilterUpdate', function() {
            if ($scope.tabFilter !== $scope.tabFilterUpdate) {
                $scope.tabFilter = $scope.tabFilterUpdate;
            }
        });

        $scope.refreshPager();

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
            if (prop.hideSorter) {
                return;
            }

            if ($scope.multisort !== 'false') {
                var existed = null;
                var orderIndex = $scope.order.indexOf(prop.order);
                if (orderIndex !== -1) {
                    existed = 'order';
                    $scope.order.splice(orderIndex, 1);
                }
                var rOrderIndex = $scope.order.indexOf(prop.rorder);
                if (rOrderIndex !== -1) {
                    existed = 'rorder';
                    $scope.order.splice(rOrderIndex, 1);
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

            var orderConfigMap = {};
            $scope.props.forEach(function (el) {
                if (el.name === prop.name) {
                    el.columnActive = true;
                } else {
                    el.columnActive = false;
                }
                if ($scope.order.indexOf(el.order) !== -1) {
                    orderConfigMap[el.name] = true;
                } else if ($scope.order.indexOf(el.rorder) !== -1) {
                    orderConfigMap[el.name] = false;
                }
            });

            if ($scope.userConfig.loaded()) {
                var userConfig = $scope.gridUserConfig.config;
                userConfig.order = orderConfigMap;
                userConfig.dirty(true);
                userConfig.$save();
            }
        };

        $scope.matchesFilter = function (item) {
            if ($scope.propertyFilter(item)) {
                if ($scope.filterAll) {
                    return $scope.props.some(function (el) {
                        if (!el.active) {
                            return false;
                        }

                        var subject = (el._getter && el._getter(item)) || (el.id2 && item[el.id][el.id2]) || item[el.id] || '';

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
            }
            return false;
        };

        $scope.changePage = function (t) {
            $scope.page = t;
        };

        $scope.showProps = function () {
            $scope.propOn = !$scope.propOn;
        };
        function getJSONData() {
            var filtered = $filter('filter')($scope.items, $scope.matchesFilter);
            var ordered = $filter('orderBy')(filtered, $scope.order);

            // List all the different properties from all items
            var order = [];
            $scope.items.forEach(function (item) {
                Object.keys(item).forEach(function (property) {
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
                var item = {};
                order.forEach(function (id) {
                    item[id] = el[id] !== undefined ? el[id] : '';
                });
                final.push(item);
            });

            return {
                data: final,
                order: order
            };
        }

        $scope.export = function (format) {
            $http.post('machine/export', getJSONData())
                .success(function (id) {
                    $scope.iframe = '<iframe src="machine/export/' + id + '/' + format + '/' + $scope.itemsType + '"></iframe>';
                })
                .error(function () {
                    console.log('err', arguments);
                });
        };

        $scope.getActionButtons = function (item) {
            if (!item) {
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
                    return btn.show(item);
                }

                return !!btn.show;
            });
        };

        $scope.areColumnsEnabled = function () {
            return $scope.columnsButton !== false;
        };

        $scope.selectAllCheckbox = function () {
            if ($scope.isCheckedAllCheckBoxDisabled) {
                return;
            }
            $scope.checkedAllCheckBox = !$scope.checkedAllCheckBox;

            $scope.pagedItems.forEach(function (el) {
                el.checked = $scope.checkedAllCheckBox;
            });
        };

        $scope.unSelectAllCheckbox = function () {
            $scope.$parent.$emit('gridViewChangeTab', $scope.tabFilter);
            $scope.checkedAllCheckBox = false;
            $scope.items.forEach(function (el) {
                el.checked = false;
            });
        };

        $scope.disableSelectAllCheckbox = function () {
            $scope.isCheckedAllCheckBoxDisabled = $scope.items.some(function (el) {
                return (el.fireWallActionRunning) || (el.job && !el.job.finished);
            });
        };

        $scope.propertyFilter = function (item) {
            if ($scope.tabFilter === 'all' || !$scope.tabFilter) {
                return true;
            }
            return item[$scope.tabFilterField] === $scope.tabFilter;
        };

        $scope.$watch('items', function (items) {
            if (items) {
                $scope.disableSelectAllCheckbox();
                refreshGrid();

                if ($scope.tabFilterField) {
                    if ($scope.tabFilterField !== 'datacenter') {
                        items.forEach(function (item) {
                            if ($scope.tabFilters.indexOf(item[$scope.tabFilterField]) === -1) {
                                $scope.tabFilters.unshift(item[$scope.tabFilterField]);
                            }
                        });
                    }
                    $scope.$parent.$emit('gridViewChangeTab', $scope.tabFilter || 'all');
                }
            }
        }, true);

        $scope.resetFilteredItemsSelection = function () {
            $scope.items.filter(function (item) {
                return $scope.pagedItems.indexOf(item) === -1;
            }).forEach(function (item) {
                item.checked = false;
            });
        };

        $scope.selectCheckbox = function (item) {
            if (!$scope.enabledCheckboxes) {
                return;
            }
            var id = item && (item.id || item.uuid || item.$$hashKey);

            $scope.pagedItems.forEach(function (el) {
                var itemId = el.id || el.uuid || el.$$hashKey;
                if (itemId === id && !el.fireWallActionRunning && (!el.job || el.job.finished)) {
                    el.checked = !el.checked;
                }
            });
            $scope.checkedAllCheckBox = areAllPagedItemsChecked();
        };

        $scope.selectColumnsCheckbox = function (id) {
            $scope.props.forEach(function (el) {
                if (el.id === id) {
                    el.active = (el.active) ? false : true;
                    if ($scope.userConfig.loaded()) {
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
                items: '=',
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
                itemsType: '@',
                placeHolderText: '=',
                multisort: '@',
                userConfig: '=',
                tabFilterField: '=',
                tabFilterDefault: '=',
                tabFilterUpdate: '=',
                hideLargePagerOptions: '@'
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
                $scope.loading = true;

                var ignore = $scope.exportFields.ignore;

                if (ignore && ignore === 'all') {
                    $scope.hideExport = true;
                }

                var pageSizes = [
                    {
                        value: 25,
                        name: 25
                    },
                    {
                        value: 50,
                        name: 50
                    },
                    {
                        value: 100,
                        name: 100
                    }
                ];

                if (attrs.hideLargePagerOptions !== 'true') {
                    pageSizes = pageSizes.concat([
                        {
                            value: 200,
                            name: 200
                        },
                        {
                            value: 10000,
                            name: 'All'
                        }
                    ]);
                }

                $scope.pageSizes = pageSizes;

                var onPropsChanges = function (scope, props) {
                    $scope.props = props || $scope.props;
                    $scope.props.forEach(function (el) {

                        if ($rootScope.features.firewall === 'enabled') {
                            if (el.id === 'firewall_enabled') {
                                el.active = true;
                            }
                            if (el.id === 'updated') {
                                el.active = false;
                            }
                        }
                        var initOrder = function (customOrder, initEl) {
                            initEl.order = customOrder;
                            if (typeof (customOrder) === 'string') {
                                initEl.rorder = '-' + customOrder;
                            } else if (typeof (customOrder) === 'function') {
                                initEl.rorder = function (obj) {
                                    var next;
                                    var value = customOrder(obj);
                                    if (typeof (value) === 'number') {
                                        next = -value;
                                    } else {
                                        var elem = String(value);
                                        var i;
                                        for (i = 0; i < elem.length; i += 1) {
                                            next += String.fromCharCode(255 - elem.charCodeAt(i));
                                        }
                                    }
                                    return next;
                                };
                            }
                        };

                        if (el._order) {
                            initOrder(el._order, el);
                        } else if (el._getter) {
                            initOrder(el._getter, el);
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
                };
                $scope.$on('propsChanged', onPropsChanges);
                onPropsChanges();

                if (!$scope.userConfig) {
                    $scope.userConfig = {
                        $load: function (callback) { this._loaded = true; callback(null, $scope.userConfig); },
                        $save: function () {},
                        $child: function () { return $scope.userConfig; },
                        dirty: function () {},
                        _loaded: false,
                        loaded: function () { return this._loaded; }
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
                    if (ng.isDefined(config.order)) {
                        $scope.order.splice(0);
                    }
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
                        if (ng.isDefined(config.order) && ng.isDefined(config.order[el.name])) {
                            $scope.order.push(config.order[el.name] ? el.order : el.rorder);
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

