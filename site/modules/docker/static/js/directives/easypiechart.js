'use strict';

(function (app) {
    app.directive('easypiechart', [function() {
        return {
            restrict: 'AE',
            scope: {
                percent: '=',
                options: '=?'
            },
            link: function (scope, element, attrs) {
                scope.percent = scope.percent || 0;
                var options = {
                    barColor: scope.options.barColor || "#44b6ae",
                    trackColor: scope.options.trackColor || '#FFFFFF',
                    scaleColor: scope.options.scaleColor || '#999999',
                    scaleLength: scope.options.scaleLength || 5,
                    lineCap: scope.options.lineCap || 'round',
                    lineWidth: scope.options.lineWidth || 3,
                    size: scope.options.size || 110,
                    rotate: scope.options.rotate || 0,
                    animate: scope.options.animate || {
                        duration: 0,
                        enabled: false
                    }
                };

                scope.$watch("percent", function () {
                    var chart = $(element).data('easyPieChart') || $(element).easyPieChart(options).data('easyPieChart');
                    if (scope.percent === 'N/A') {
                        chart.options['barColor'] = 'red';
                        chart.update(100);
                    } else {
                        chart.update(scope.percent);
                    }
                });
            }
        };
    }]);
}(window.JP.getModule('docker')));