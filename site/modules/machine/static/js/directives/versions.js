'use strict';

(function (app) {
    app.directive('versions', [function () {
        return {
            templateUrl: 'machine/static/partials/versions.html'
        };
    }]);
}(window.JP.getModule('Machine')));