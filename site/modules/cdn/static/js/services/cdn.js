'use strict';

(function (app) {
    app.factory('cdn', [
        'serverTab',
        function (serverTab) {
            var service = {};

            service.getApiKey = function (callback) {
                return serverTab.call({
                    name: 'GetApiKey',
                    data: {},
                    done: callback
                }).promise;
            };

            service.addApiKey = function (data, callback) {
                return serverTab.call({
                    name: 'AddApiKey',
                    data: data,
                    done: callback
                }).promise;
            };

            service.updateApiKey = function (data, callback) {
                return serverTab.call({
                    name: 'UpdateApiKey',
                    data: data,
                    done: callback
                }).promise;
            };

            service.createConfiguration = function (data, callback) {
                return serverTab.call({
                    name: 'CreateConfiguration',
                    data: data,
                    done: callback
                }).promise;
            };

            return service;
        }
    ]);
}(window.JP.getModule('cdn')));