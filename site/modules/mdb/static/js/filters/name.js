'use strict';

(function (app) {

    app.filter('name', function () {
        return function (name) {
            if (name) {
                return name.toString().replace(/.*\/([^$]+)$/g, '$1');
            }
            return name;
        };
    });

}(window.JP.getModule('mdb')));