'use strict';

(function (ng, app) {
    app.directive('flamegraph', ['$location', 'loggingService', '$compile', '$route', 'DTrace', 'PopupDialog',
        function ($location, loggingService, $compile, $route, DTrace, PopupDialog) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                options: '=',
                data: '=?'
            },
            template: function (element, attrs) {
                return '<div class="flamegraph"></div>';
            },
            link: function ($scope, element, attrs) {
                function getFlamegraph(svg) {
                    try {
                        svg = JSON.parse(svg);
                    } catch (ex) {
                        svg = '';
                        var message = 'Error parsing json for flamegraph';
                        PopupDialog.errorObj(message + '.');
                        loggingService.log('error', message);
                    }
                    if (svg) {
                        ng.element(element).html(svg).promise().done(function () {
                            init();
                        });
                        DTrace.saveFlameGraph({
                            svg: svg,
                            id: $scope.options.hostId
                        }).then(function () {}, function (err) {
                            PopupDialog.errorObj(err);
                            loggingService.log('error', 'Error while saving flamegraph svg to manta');
                        });
                    }
                };

                $scope.$watch('data', function (data) {
                    ng.element(element).html('');
                    if (data) {
                        getFlamegraph(data);
                    }
                });
            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));
