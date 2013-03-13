'use strict';

(function (app) {
    app.factory('$$track', ["$location", function ($location) {

        return {
            event: function () {
            },
            page: function () {
            }
        }
    }]);

}(window.JP.getModule('Tracking')));