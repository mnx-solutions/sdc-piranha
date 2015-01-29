'use strict';

(function (app) {
    app.controller(
        'DTrace.HeatmapController', [
            '$scope',
            function ($scope) {

                $scope.loading = true;

            }
        ]);
}(window.JP.getModule('dtrace')));
