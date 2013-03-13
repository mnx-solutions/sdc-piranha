'use strict';

(function (app) {
    app.factory('$$track', ["$location", function ($location) {

        return {
            event: function (category, action, label) {
                _gaq.push(["_trackEvent", category, action, label || ""])

            },
            page: function () {
                _gaq.push(['_trackPageview', $location.path()]);
            },
            timing: function (category, variable, time) {
                _gaq.push(['_trackTiming', category, variable, time]);
            }

        }
    }]);

}(window.JP.getModule('Tracking')));
