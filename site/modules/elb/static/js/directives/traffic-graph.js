'use strict';

(function (app) {
    app.directive('trafficGraph', [
        'elb.trafficChart',
        function (trafficChart) {
            return {
                priority: 500,
                restrict: 'A',
                transclude: true,
                replace: true,
                scope: {
                    traffic: '='
                },

                link: function ($scope, $element, $attrs) {
                    var chart = trafficChart($element, $attrs.title, $scope.traffic);
                    $scope.$watch('traffic', function (data) {
                        if (!data) {
                            return;
                        }

                        chart.setTraffic(data);
                        chart.update();
                    });
                }
            };
        }
    ]);
}(window.JP.getModule('elb')));