'use strict';

(function (app) {
    // I provide information about the current route request.
// app.factory('Menu', ['$resource', 'requestContext',
// function ($resource, requestContext) {
    app.factory('Menu', ['$resource', function ($resource) {
            var Menu = $resource('/menu', {}, {});
            var mainMenu = [
                {link: 'xxx', name: 'Dashboard'},
                {link: 'xxx', name: 'Storage'}
            ];

            Menu.getMenu = function () {
                return mainMenu;
            };

            Menu.register = function (item) {
                mainMenu.push(item);
            };

            return Menu;
        }]);
}(window.JP.getModule('Menu')));