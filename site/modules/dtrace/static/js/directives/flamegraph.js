'use strict';

(function (ng, app) {
    app.directive('flamegraph', ['DTrace',
        function (DTrace) {
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
                    if (svg) {
                        ng.element(element).html(svg).promise().done(function () {
                            init();
                        });
                        DTrace.saveFlameGraph({
                            svg: svg,
                            id: $scope.options.hostId
                        }).then(function () {}, function (err) {
                            DTrace.reportError(err, 'Error while saving flamegraph svg to manta');
                        });
                    }
                }

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
