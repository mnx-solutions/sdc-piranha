'use strict';

(function (ng, app) {
    app.controller('GridViewController', ['$scope','$filter','$http', function ($scope, $filter, $http) {
        $scope.getLastPage = function (update) {
            if ($scope.objects) {
                var lastPage =  Math.ceil($filter('filter')($scope.objects, $scope.matchesFilter).length / $scope.perPage);

                if(update && lastPage) {
                    $scope.lastPage = lastPage;
                }

                return lastPage;

            }
        };

        $scope.$watch('objects', $scope.getLastPage.bind($scope, true), true);
        $scope.$watch('props', $scope.getLastPage.bind($scope, true), true);
        $scope.$watch('perPage', $scope.getLastPage.bind($scope, true), true);

        $scope.getLastPage(true);

        $scope.isOnPage = function(index) {
            return (index >= $scope.perPage * ($scope.page - 1)) && (index < ($scope.perPage * $scope.page));
        };

        $scope.showAll = function () {
            $scope.oldPerPage = $scope.perPage;
            $scope.perPage = 10000;
        };

        $scope.showPaginated = function () {
            $scope.perPage = $scope.oldPerPage;
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
            if($scope.multisort !== 'false') {
                var existed = null;
                if($scope.order.indexOf(prop.order) !== -1) {
                    existed = 'order';
                    delete $scope.order[$scope.order.indexOf(prop.order)];
                }
                if($scope.order.indexOf(prop.rorder) !== -1) {
                    existed = 'rorder';
                    delete $scope.order[$scope.order.indexOf(prop.rorder)];
                }
                if(reverse === undefined) {
                    if(!existed) {
                        $scope.order.push(prop.order);
                    } else if(existed === 'order'){
                        $scope.order.push(prop.rorder);
                    }
                } else if((reverse && existed !== 'rorder') || (!reverse && existed !== 'order')) {
                    $scope.order.push(reverse ? prop.rorder : prop.order);
                }
            } else {
                var order = $scope.order[0];

                if(order === prop.order) {
                    $scope.order = [prop.rorder];
                } else {
                    $scope.order = [prop.order];
                }
            }
        };

        $scope.matchesFilter = function (obj) {
            var all = true;
            if($scope.filterAll) {
                all = $scope.props.some(function (el) {
                    if(!el.active) {
                        return false;
                    }

                    var subject = (el._getter && el._getter(obj)) || (el.id2 && obj[el.id][el.id2]) || obj[el.id] || '';

                    if (ng.isNumber(subject)) {
                        subject = subject.toString();
                    }

                    var needle = $scope.filterAll.toLowerCase();

                    return (subject.indexOf(needle) !== -1);
                });
            }

            return all && !$scope.props.some(function (el) {
                if(!el.active || !el.filter) {
                    return false;
                }

                var subject = (el._getter && el._getter(obj)) || (el.id2 && obj[el.id][el.id2]) || obj[el.id] || '';

                if (ng.isNumber(subject)) {
                    subject = subject.toString();
                }

                var needle = el.filter.toLowerCase();

                return (subject.indexOf(needle) === -1);
            });
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

            var order = ($scope.objects[0] && Object.keys($scope.objects[0])) || [];
            var final = [];
            if($scope.exportFields.ignore) {
                order = order.filter(function (k) { return $scope.exportFields.ignore.indexOf(k) === -1; });
            }
            if($scope.exportFields.fields) {
                order = order.filter(function (k) { return $scope.exportFields.ignore.indexOf(k) !== -1; });
            }

            ordered.forEach(function (el) {
                var obj = {};
                order.forEach(function (id) {
                    obj[id] = el[id];
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
            if(!object) {
                return $scope.actionButtons;
            }
	        if(!$scope.actionButtons) {
		        return [];
	        }

            return $scope.actionButtons.filter(function (btn) {
                if(btn.show === undefined) {
                    return true;
                }
                if(typeof btn.show === 'function') {
                    return btn.show(object);
                }

                return !!btn.show;
            });
        };
    }])
    .constant('gridConfig', {
        paginated: true,
        perPage: 15,
        page: 1,
        showPages: 5,
        order: [],
        propOn: false,
        multisort: true
    })
    .directive('gridView', ['gridConfig', function(gridConfig) {
        return {
            restrict: 'EA',
            scope: {
                order: '=',
                props: '=',
                detailProps: '=',
                objects: '=',
                actionButtons:'=',
                filterAll: '@',
                exportFields: '=',
                objectsType: '@',
                multisort: '@'
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

                $scope.props.forEach(function (el) {
                    el.active = true;
	                if(el._getter) {
		                el.order = el._getter;
		                el.rorder = function (obj) {
			                var elem = el._getter(obj) + '';
			                var next = '';
			                for(var i = 0; i < elem.length; i++) {
				                next += String.fromCharCode(255 - elem.charCodeAt(i));
			                }
			                return next;
		                };
	                } else if(!el.id2) {
                        el.order = el.id;
                        el.rorder = '-' + el.id;
                    } else {
                        el.order = el.id + '.' + el.id2;
                        el.rorder = '-' + el.id + '.' + el.id2;
                    }
                });

            }
        };
    }])
    .filter('jsonArray', function () {
        return function (array) {
            if(ng.isArray(array)) {
                return array.join('; ');
            }
            return JSON.parse(array).join('; ');
        };
    });
}(window.angular, window.JP.getModule('Machine')));

