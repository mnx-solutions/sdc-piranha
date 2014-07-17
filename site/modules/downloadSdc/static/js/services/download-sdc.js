'use strict';

(function (app) {
    app.factory('sdcService', [
        'serverTab',
        function (serverTab) {
            var service = {};

            service.getSdcInfo = function () {
                var call = serverTab.call({
                    name: 'getSdcInfo'
                });
                return call.promise;
            };

            return service;
        }]);
}(window.JP.getModule('downloadSdc')));
