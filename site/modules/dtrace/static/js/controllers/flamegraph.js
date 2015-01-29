'use strict';

(function (app) {
    app.controller(
        'DTrace.FlamegraphController', [
            '$scope',
            function ($scope) {

                $scope.loading = true;

            }
        ]);
}(window.JP.getModule('dtrace')));
