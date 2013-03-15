'use strict';

(function (app) {
    app.factory('$$track', ["$location", function ($location) {

        return {
            event: function () {
            },
            page: function () {
            },
            timing: function () {
            }
        }
    }]);

}(window.JP.getModule('Tracking')));