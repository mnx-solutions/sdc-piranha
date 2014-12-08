'use strict';

(function (app) {
    app.factory('cdn', [
        'serverTab',
        function (serverTab) {
            var service = {};

            service.getApiKey = function () {
                return serverTab.call({
                    name: 'GetApiKey',
                    data: {}
                }).promise;
            };

            service.addApiKey = function (data) {
                return serverTab.call({
                    name: 'AddApiKey',
                    data: data
                }).promise;
            };

            service.updateApiKey = function (data) {
                return serverTab.call({
                    name: 'UpdateApiKey',
                    data: data
                }).promise;
            };

            service.createConfiguration = function (data) {
                return serverTab.call({
                    name: 'CreateConfiguration',
                    data: data
                }).promise;
            };

            service.listConfigurations = function (data) {
                return serverTab.call({
                    name: 'ListServices',
                    data: data
                }).promise;
            };

            service.deleteConfiguration = function (data) {
                return serverTab.call({
                    name: 'DeleteConfiguration',
                    data: data
                }).promise;
            };

            service.domainStatus = function (data) {
                return serverTab.call({
                    name: 'DomainStatus',
                    data: data
                }).promise;
            };

            return service;
        }
    ]);
}(window.JP.getModule('cdn')));