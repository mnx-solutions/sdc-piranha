'use strict';

(function (app) {
    app.filter('shortTag', function () {
        return function (input) {
            return input && input.slice(0, 12);
        };
    });

}(window.JP.getModule('docker')));
