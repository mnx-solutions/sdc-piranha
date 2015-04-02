'use strict';

(function (app) {
    // provide information about the current route request.
    app.factory('Menu', ['$resource', function ($resource) {

        var Menu = $resource('/menu', {}, {});
        var mainMenu = [];

        Menu.getMenu = function () {
            return mainMenu;
        };

        Menu.register = function (item) {
            mainMenu.push(item);
        };

        Menu.register = function (item) {

            mainMenu.push(item);
            mainMenu.sort(function (a, b) {
                if (!a.order && !b.order) {
                    return 0;
                }
                if (!a.order) {
                    return 1;
                }
                if (!b.order) {
                    return -1;
                }
                if (a.order < b.order) {
                    return -1;
                }
                if (a.order > b.order) {
                    return 1;
                }
                return 0;
            });
        };

        return Menu;
    }]);
}(window.JP.getModule('Menu')));
