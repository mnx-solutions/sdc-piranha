'use strict';

(function (app) {
    app.directive('monthNavigation', ['$location', 'requestContext',
        function ($location, requestContext) {
            return {
                scope: true,
                restrict: 'EA',

                link: function ($scope, $element, $attrs) {
                    var getUrl = function (targetDate) {
                        var pathParts = $location.path().split('/');
                        pathParts.length = pathParts.length - 2;
                        return '#!' + pathParts.join('/') + '/' + targetDate.getFullYear() + '/' + (targetDate.getMonth() + 1);
                    };
                    var loadData = function () {
                        var now = new Date();
                        var year = parseInt(requestContext.getParam('year'), 10);
                        var month = parseInt(requestContext.getParam('month'), 10);
                        $scope.isCurrentMonth = (year === now.getFullYear() && month === now.getMonth() + 1);
                        $scope.switchUrl = getUrl($scope.isCurrentMonth ? new Date(year, month - 2, 1) : now);
                    };
                    $scope.$on('requestContextChanged', loadData);
                    loadData();
                },

                templateUrl: 'utilization/static/partials/month-navigation.html'
            };
        }
    ]);
}(window.JP.getModule('utilization')));