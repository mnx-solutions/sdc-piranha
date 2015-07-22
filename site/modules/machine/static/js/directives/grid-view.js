(function (ng, app) {app.controller('GridViewController',
    ['$scope', '$parse', '$filter', '$http', '$location', 'Account', '$rootScope', 'Datacenter', 'PopupDialog', '$qe', '$sce', 'ErrorService', '$timeout', '$q',
    function ($scope, $parse, $filter, $http, $location, Account, $rootScope, Datacenter, PopupDialog, $qe, $sce, ErrorService, $timeout, $q) {

        'use strict';

        $scope.location = $location;
        $scope.checkedItems = [];
        var types = {};

        function ipToInt(ipAddress) {
            var result = 0;
            if (ipAddress) {
                var octets = ipAddress.split('.');
                var buffer = new ArrayBuffer(4);
                var dataView = new DataView(buffer);
                for (var i = 0; i < 4; i++) {
                    dataView.setUint8(i, octets[i]);
                }
                result = dataView.getUint32(0);
            }
            return result;
        }

        $scope.props.forEach(function (prop) {
            var entryType = prop.entryType === 'ipAddress' ? ipToInt : prop.entryType;
            if (entryType) {
                types[prop.id] = entryType;
            }
        });

        function refreshGrid() {
            $scope.refreshPager();
            var filteredItems = $filter('filter')($scope.items, $scope.matchesFilter);
            var reverse;
            var order = (Array.isArray($scope.order) ? $scope.order : [$scope.order]).map(function (order) {
                if (ng.isFunction(order)) {
                    return order;
                }
                var prop = order[0] === '+' || order[0] === '-' ? order.substr(1) : order;
                if (!types[prop]) {
                    return order;
                }
                reverse = order[0] === '-';
                return function (entry) {
                    return types[prop]($parse(prop)(entry));
                };
            });

            var orderedItems = $filter('orderBy')(filteredItems, order, reverse);
            $scope.pagedItems = orderedItems && orderedItems.filter(function (item, index) {
                return $scope.isOnPage(index);
            });
            $scope.checkedAllCheckBox = areAllPagedItemsChecked();
            if ($scope.tabFilterField && $scope.noEntriesMessageErrorType) {
                $scope.noEntriesMessage = ErrorService.getLastErrors($scope.noEntriesMessageErrorType, $scope.tabFilter) || $scope.defaultNoEntriesMessage;
            }
        }

        function getLowerCaseSting(value) {
            value = value || '';
            if (value) {
                if (ng.isNumber(value) || typeof (value) === 'boolean') {
                    value = value.toString();
                }
                if (ng.isObject(value) || ng.isArray(value)) {
                    value = JSON.stringify(value);
                }
            }
            return value.toLowerCase();
        }

        function searchInObject(obj, needle) {
            var result = false;
            if (ng.isObject(obj)) {
                result = Object.keys(obj).some(function (key) {
                    var propertyValue = getLowerCaseSting(obj[key]);
                    return propertyValue.indexOf(needle) !== -1;
                });
            }
            return result;
        }

        $scope.$watch('pagedItems', function (items) {
            var asyncProps = $scope.props.filter(function (prop) {
                return prop.type === 'async';
            });

            if (items && items.length && asyncProps.length) {
                var iterator = function (item, callback) {
                    asyncProps.forEach(function (prop) {
                        $qe.when(prop._getter(item)).then(function (result) {
                            item[prop.name] = result;
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

        angular.element(window).resize(function () {
            angular.element('.select-datacenter').select2('close');
        });

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
                        $timeout(function () {
                            $scope.tabFilter = $scope.forceTabActive || config.value;
                        });
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
                }, function () {
                    $scope.tabFilters = [];
                    loadCurrentTabFilter();
                });
            } else {
                if ($scope.tabFilterField === 'state') {
                    $scope.tabFilters = ['running', 'all'];
                    loadCurrentTabFilter();
                } else if ($scope.tabFilterField === 'logs') {
                    $scope.tabFilters = ['Running', 'All existing', 'Deleted'];
                    $scope.tabFilter = 'Running';
                    setCurrentTabFilter();
                } else if ($scope.tabFilterField === 'action') {
                    $scope.tabFilters = ['Key actions', 'All'];
                    $scope.tabFilter = 'Key actions';
                    setCurrentTabFilter();
                } else {
                    $scope.tabFilters = ['top', 'all', 'graph'];
                    $scope.tabFilter = 'top';
                    setCurrentTabFilter();
                }
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
            if ($scope.exportFields.ignore) {
                $scope.hideExport = false;
                if ($scope.exportFields.ignore === 'all') {
                    $scope.hideExport = true;
                }
            }
        });

        $scope.$watch('tabFilterUpdate', function() {
            if ($scope.tabFilter !== $scope.tabFilterUpdate && $scope.tabFilterUpdate) {
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
            if ($scope.fantomSort) {
                var primary = $scope.fantomSort.primary;
                var secondary = $scope.fantomSort.secondary;

                if (primary.name === prop.name && !$scope.fantomSort.active) {
                    $scope.fantomSort.active = true;
                    $scope.orderGridMachinesBy(prop);
                    $scope.multisort = true;
                    $scope.props.forEach(function (secondaryProp) {
                        if (secondary.name === secondaryProp.name) {
                            var orderIdx = $scope.order.indexOf(secondaryProp.order);
                            if (orderIdx !== -1) {
                                $scope.order.splice(orderIdx, secondary.order);
                            }
                            $scope.orderGridMachinesBy(secondaryProp);
                            secondaryProp.columnActive = false;
                            $scope.multisort = 'false';
                        }
                    });
                    prop.columnActive = true;
                    $scope.fantomSort.active = false;
                    return;
                }
            }
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
                if ($scope.fantomSort && $scope.fantomSort.active) {
                    delete userConfig.order;
                }
                userConfig.dirty(true);
                userConfig.$save();
            }
        };

        $scope.matchesFilter = function (item) {
            var result = false;
            if ($scope.propertyFilter(item)) {
                result = true;
                if ($scope.filterAll) {
                    var needle = $scope.filterAll.toLowerCase();
                    if (!searchInObject(item, needle)) {
                        result = $scope.props.some(function (el) {
                            if (el.active) {
                                var subject = el._getter && el._getter(item) || item[el.id] || el.id2 && item[el.id][el.id2] || '';
                                if (el.id === 'hostId' && item.hostIds && item.hostIds.length > 0) {
                                    subject = item.hostIds;
                                }
                                subject = getLowerCaseSting(subject);

                                return subject.indexOf(needle) !== -1;
                            } else {
                                return false;
                            }
                        });
                    }
                }
            }
            return result;
        };

        $scope.changePage = function (t) {
            $scope.page = t;
        };

        $scope.showProps = function () {
            $scope.propOn = !$scope.propOn;
        };

        var getShortDate = function (date) {
            var crop = function (dateString) {
                return dateString.replace('T', ' ').substring(0, 16);
            };
            if (typeof(date) === 'string') {
                return crop(date);
            } else if (typeof(date) === 'object') {
                return crop(date.toISOString());
            }
            return date;
        };

        function getJSONData() {
            var filtered = $filter('filter')($scope.items, $scope.matchesFilter);
            var ordered = $filter('orderBy')(filtered, $scope.order);

            // List all the different properties from all items
            var order = [];
            var data = [];
            var promises = [];

            ordered.forEach(function (item) {
                var newItem = {};
                $scope.props.forEach(function (prop) {
                    var name = prop.name;
                    if (prop.hasOwnProperty('_export')) {
                        var res = prop._export(item);
                        if (typeof(res) === 'object' && res.hasOwnProperty('then')) {
                            promises.push(res.then(function (result) {
                                newItem[name] = result;
                            }));
                        } else {
                            newItem[name] = res;
                        }
                    } else if ((prop.hasOwnProperty('_getter') && prop.type !== 'html' && prop.type !== 'progress')) {
                        newItem[name] = prop._getter(item);
                    } else if (prop.type === 'date') {
                        newItem[name] = getShortDate(item[prop.id]);
                    }  else if (prop.type === 'array') {
                        newItem[name] = item[prop.id].join(', ');
                    } else {
                        newItem[name] = item[prop.id];
                    }
                    if (order.indexOf(name) === -1) {
                        order.push(name);
                    }
                });
                data.push(newItem);
            });

            if ($scope.exportFields.ignore) {
                order = order.filter(function (k) { return $scope.exportFields.ignore.indexOf(k) === -1; });
            }
            if ($scope.exportFields.fields) {
                order = order.filter(function (k) { return $scope.exportFields.ignore.indexOf(k) !== -1; });
            }

            return $q.all(promises).then(function () {
                return {
                    data: data,
                    order: order
                };
            });
        }

        $scope.export = function (format) {
            if ($scope.exportInProgress) {
               return;
            }
            $scope.exportInProgress = true;
            getJSONData().then(function (data) {
                $http.post('machine/export', data)
                    .success(function (id) {
                        $scope.exportInProgress = false;
                        $scope.iframe = $sce.trustAsHtml('<iframe src="machine/export/' + id + '/' + format + '/' + $scope.itemsType + '"></iframe>');
                    })
                    .error(function () {
                        $scope.exportInProgress = false;
                        window.console.log('err', arguments);
                    });
            });

        };

        $scope.getActionButtons = function (item) {
            var actionButtons = [];
            if (!item && $scope.actionButtons !== undefined) {
                actionButtons = $scope.actionButtons;
            }
            if ($scope.actionButtons) {
                actionButtons = $scope.actionButtons.filter(function (btn) {
                    if (btn.show === undefined) {
                        return true;
                    }
                    if (typeof (btn.show) === 'function') {
                        return btn.show(item);
                    }

                    return !!btn.show;
                });
            }
            return actionButtons;
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

            $scope.checkedItems = $scope.checkedAllCheckBox ? $scope.pagedItems : [];
        };

        $scope.unSelectAllCheckbox = function () {
            $scope.$parent.$emit('gridViewChangeTab', $scope.tabFilter);
            $scope.checkedAllCheckBox = false;
            $scope.items.forEach(function (el) {
                el.checked = false;
            });
            $scope.checkedItems = [];
        };

        var actionInProgress = function (el) {
            return (el.fireWallActionRunning) || (el.job && !el.job.finished) || el.deleteJob || el.actionInProgress;
        };

        $scope.disableSelectAllCheckbox = function () {
            $scope.isCheckedAllCheckBoxDisabled = $scope.items.some(function (el) {
                return actionInProgress(el);
            });
        };

        $scope.isCheckBoxDisabled = function (el) {
            return actionInProgress(el);
        };

        $scope.$watch('items', function (items) {
            if ($scope.enabledCheckboxes && items && items.length > 0) {
                items.forEach(function (item) {
                    item.checked = false;
                });
            }
        });

        $scope.propertyFilter = function (item) {
            if (ng.isString($scope.tabFilter) && $scope.tabFilter.toLowerCase() === 'all' || !$scope.tabFilter) {
                return true;
            }
            return item[$scope.tabFilterField] === $scope.tabFilter;
        };

        $scope.$watch('items', function (items) {
            if (items) {
                $scope.disableSelectAllCheckbox();
                refreshGrid();

                if ($scope.tabFilterField) {
                    $scope.$parent.$emit('gridViewChangeTab', $scope.tabFilter || 'all');
                }
            }
        }, true);

        $scope.resetFilteredItemsSelection = function () {
            if ($scope.items) {
                $scope.items.filter(function (item) {
                    return $scope.pagedItems.indexOf(item) === -1;
                }).forEach(function (item) {
                    item.checked = false;
                });
            }
        };

        $scope.selectCheckbox = function (item) {
            if (!$scope.enabledCheckboxes) {
                return;
            }
            var id = item && (item.id || item.uuid || item.$$hashKey);

            $scope.pagedItems.forEach(function (el) {
                var itemId = el.id || el.uuid || el.$$hashKey;
                if (itemId === id && !actionInProgress(el)) {
                    el.checked = !el.checked;
                }
                if (el.deleteJob) {
                    el.checked = false;
                }
            });
            $scope.checkedItems = $scope.pagedItems.filter(function (item) {
                return item.checked;
            });

            $scope.checkedAllCheckBox = areAllPagedItemsChecked();
        };

        $scope.selectColumnsCheckbox = function (id) {
            function oneCheckboxSelected(checkbox) {
                var noCheckboxSelected = $scope.props.filter(function (el) {
                    return el.active;
                }).length < 1;
                if (noCheckboxSelected) {
                    checkbox.active = true;
                    PopupDialog.message(null, 'At least one column should be selected.');
                }
            }
            $scope.props.forEach(function (el) {
                if (el.id === id) {
                    el.active = (el.active) ? false : true;
                    oneCheckboxSelected(el);
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

        $scope.isFantomSort = function (column) {
            var result = false;
            if ($scope.fantomSort && $scope.order.length > 1 && $scope.fantomSort.secondary.name === column.name) {
                $scope.props[$scope.props.indexOf(column)].columnActive = false;
                result = true;
            }
            return result;
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
                imageButtonShow: '=',
                filterAll: '@',
                exportFields: '=',
                columnsButton: '=',
                actionsButton: '=',
                specialWidth: '=',
                forceActive: '=?',
                forceTabActive: '=?',
                //TODO: What are these forms?
                searchForm: '=',
                instForm: '=',
                imgForm: '=',
                enabledCheckboxes: '=',
                itemsType: '@',
                placeHolderText: '=',
                multisort: '@',
                fantomSort: '=',
                userConfig: '=',
                tabFilterField: '=',
                tabFilterDefault: '=',
                tabFilterUpdate: '=',
                hideLargePagerOptions: '@',
                noEntriesMessage: '@',
                noEntriesMessageErrorType: '@',
                checkedItems: '=?'
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
                $scope.defaultNoEntriesMessage = $scope.noEntriesMessage;

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

                var setColumnActive = function(column) {
                    column.columnActive = $scope.order.indexOf(column.order) !== -1 || $scope.order.indexOf(column.rorder) !== -1;
                };

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
                                        var elementValue = String(value);
                                        var i;
                                        for (i = 0; i < elementValue.length; i += 1) {
                                            next += String.fromCharCode(255 - elementValue.charCodeAt(i));
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
                        setColumnActive(el);
                    });
                };
                onPropsChanges();

                var loadUserConfig = function () {
                    if (!$scope.userConfig) {
                        $scope.userConfig = {
                            $load: function (callback) {
                                this._loaded = true;
                                callback(null, $scope.userConfig);
                            },
                            $save: function () {
                            },
                            $child: function () {
                                return $scope.userConfig;
                            },
                            dirty: function () {
                            },
                            _loaded: false,
                            loaded: function () {
                                return this._loaded;
                            }
                        };
                    }

                    $scope.userConfig.$load(function (error, config) {
                        if (error) {
                            $scope.loading = false;
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

                        if (ng.isDefined(config.order)) {
                            $scope.order.splice(0);
                        }

                        $scope.props.forEach(function (el) {
                            if (propKeys[el.id]) {
                                if (el.id === $scope.forceActive) {
                                    el.active = true;
                                } else {
                                    el.active = propKeys[el.id].active;
                                }
                            } else {
                                propKeys[el.id] = el;
                                config.props.push(el);
                                config.dirty(true);
                            }
                            if (ng.isDefined(config.order) && ng.isDefined(config.order[el.name])) {
                                $scope.order.push(config.order[el.name] ? el.order : el.rorder);
                            }
                            setColumnActive(el);
                        });
                        config.$save();
                        $scope.loading = false;
                    });
                };

                $scope.$watch('userConfig', function () {
                    $scope.loading = true;
                    loadUserConfig();
                });

                $scope.$on('propsChanged', function(event, args) {
                    onPropsChanges(null, args.props);
                    $scope.userConfig = args.gridUserConfig;
                    loadUserConfig();
                });

                $scope.$watch('perPage', function (num) {
                    if (ng.isDefined(num) && $scope.paginated) {
                        var config = $scope.userConfig;
                        if (config.loaded() && config.perPage != num) {
                            config.perPage = $scope.perPage;
                            config.dirty(true);
                            config.$save();
                        }
                    }
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
