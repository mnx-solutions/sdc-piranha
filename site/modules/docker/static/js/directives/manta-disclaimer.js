'use strict';

(function (app) {
    app.directive('mantadisclaimer', function () {
        return {
            template: 'Note: Any Manta charges for storing Docker logs, private registries and images will apply. <br />Please refer to the following for Joyent Manta Service pricing: <a href="https://www.joyent.com/products/manta/pricing" class="orange-link" target="_blank">https://www.joyent.com/products/manta/pricing</a>'
        };
    });
}(window.JP.getModule('docker')));