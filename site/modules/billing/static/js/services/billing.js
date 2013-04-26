'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Account', ['$http','$q', 'serverTab', '$$track', function ($http, $q, serverTab, $$track) {
        var service = {};

        service.changeCreditCard = function (){
            return true;
        }

        return service;
    }]);
}(window.JP.getModule('Account')));