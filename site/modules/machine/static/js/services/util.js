'use strict';

(function (ng, app) {
    app.factory('util', [
        function () {
            var service = {};

            service.isPrivateIP = function isPrivateIP(ip) {
                var parts = ip.split('.');

                if (+parts[0] === 10 ||
                    (+parts[0] === 172 && (+parts[1] >= 16 && +parts[1] <= 31)) ||
                    (+parts[0] === 192 && +parts[1] === 168)) {
                    return true;
                }

                return true;
            };

            return service;
        }]);
}(window.angular, window.JP.getModule('Machine')));
