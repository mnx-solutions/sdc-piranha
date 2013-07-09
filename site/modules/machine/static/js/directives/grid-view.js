'use strict';

(function (ng, app) {
    app.controller('GridViewController', ['$scope','$filter','$http', function ($scope, $filter, $http) {
        $scope.getLastPage = function (update) {
            var lastPage =  Math.ceil($filter('filter')($scope.objects, $scope.matchesFilter).length / $scope.perPage);
            if(update) {
                $scope.lastPage = lastPage;
            }
            return lastPage;
        };
        $scope.$watch('objects', $scope.getLastPage.bind($scope, true), true);
        $scope.$watch('props', $scope.getLastPage.bind($scope, true), true);

        $scope.getLastPage(true);

        $scope.isOnPage = function(index) {
            return (index >= $scope.perPage * ($scope.page - 1)) && (index < ($scope.perPage * $scope.page));
        };

        $scope.clearOrder = function () {
            $scope.order = [];
        };

        $scope.orderGridMachinesBy = function (prop, reverse) {
            var existed = null;
            if($scope.order.indexOf(prop.order) !== -1) {
                existed = 'order';
                delete $scope.order[$scope.order.indexOf(prop.order)];
            }
            if($scope.order.indexOf(prop.rorder) !== -1) {
                existed = 'rorder';
                delete $scope.order[$scope.order.indexOf(prop.rorder)];
            }
            if((reverse && existed !== 'rorder') || (!reverse && existed !== 'order')) {
                $scope.order.push(reverse ? prop.rorder : prop.order);
            }
        };

        $scope.matchesFilter = function (obj) {
            return !$scope.props.some(function (el) {
                if(!el.active || !el.filter) {
                    return false;
                }
                var subject = (el.id2 && obj[el.id][el.id2]) || obj[el.id];

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

            var filteredP = $filter('filter')($scope.props, {active:true});
            var orderedP = $filter('orderBy')(filteredP, 'sequence');

            var orderInfo = [];
            orderedP.forEach(function (p) {
                orderInfo.push(p.name);
            });
            var final = [];
            ordered.forEach(function (el) {
                var obj = {};
                orderedP.forEach(function (p) {
                    if(p.id2) {
                        obj[p.name] = el[p.id][p.id2];
                    } else {
                        obj[p.name] = el[p.id];
                    }
                });
                final.push(obj);
            });

            return {
                data: final,
                order: orderInfo
            };
        }

        $scope.export = function (format) {
            $http.post('machine/export', getJSONData())
                .success(function (id) {
                    $scope.iframe = '<iframe src="machine/export/' + id + '/' + format + '"></iframe>';
                })
                .error(function () {
                    console.log('err', arguments);
                });
        };
    }])
    .constant('gridConfig', {
        perPage: 15,
        page: 1,
        showPages: 5,
        order: [],
        propOn: false
    })
    .directive('gridView', ['gridConfig', function(gridConfig) {
        return {
            restrict: 'EA',
            scope: {
                order: '=',
                props: '=',
                objects: '='
            },
            controller: 'GridViewController',
            templateUrl: 'machine/static/partials/grid-view.html',
            replace: true,
            link: function($scope, element, attrs) {
                $scope.perPage = ng.isDefined(attrs.perPage) ? $scope.$eval(attrs.perPage) : gridConfig.perPage;
                $scope.showPages = ng.isDefined(attrs.showPages) ? $scope.$eval(attrs.showPages) : gridConfig.showPages;
                $scope.page = $scope.page || gridConfig.page;
                $scope.order = $scope.order || gridConfig.order;
                $scope.propOn = ng.isDefined(attrs.propOn) ? $scope.$eval(attrs.propOn) : gridConfig.propOn;

                $scope.props.forEach(function (el) {
                    el.active = true;
                    if(!el.id2) {
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
    .filter('dateTime', function () {
        return function (dateString) {
            return window.moment(new Date(dateString)).format("MMM Do");
        };
    })
    .filter('jsonArray', function () {
        return function (array) {
            if(ng.isArray(array)) {
                return array.join('; ');
            }
            return JSON.parse(array).join('; ');
        };
    });
}(window.angular, window.JP.getModule('Machine')));

