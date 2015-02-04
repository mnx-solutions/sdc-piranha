'use strict';

(function (ng, app) {
    app.factory('DTrace', [
        'serverTab',
        'PopupDialog',
        '$q',
        '$rootScope',
        function (serverTab, PopupDialog, $q, $rootScope) {

            if ($rootScope.features.dtrace !== 'enabled') {
                return;
            }

            var service = {};

            service.createScript = function (script) {
                return serverTab.call({
                    name: 'SaveScript',
                    data: script
                }).promise;
            };

            service.removeScript = function (ids) {
                return serverTab.call({
                    name: 'DeleteScripts',
                    data: {ids: ids}
                }).promise;
            };

            service.getScriptsList = function () {
                return serverTab.call({
                    name: 'GetScripts'
                }).promise;
            };

        return service;
    }]);
}(window.angular, window.JP.getModule('dtrace')));
