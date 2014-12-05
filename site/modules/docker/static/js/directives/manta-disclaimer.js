'use strict';

(function (app) {
    app.directive('mantadisclaimer', function () {
        return {
            template: '<b>Note:</b> Any Manta charges for storing Docker logs, private registries and images will apply. Please refer to <a href="https://www.joyent.com/products/manta/pricing" class="active-link" target="_blank">Joyent Manta Service Pricing</a>'
        };
    });
}(window.JP.getModule('docker')));