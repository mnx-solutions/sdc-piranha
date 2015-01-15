'use strict';

(function (app) {
    app.directive('mantadisclaimer', function () {
        return {
            template: '<span data-ng-show="features.privateSdc != \'enabled\'"><b>Note:</b> Manta charges for storing Docker logs, private registries and images will apply. Please refer to <a href="https://www.joyent.com/products/manta/pricing" class="active-link" target="_blank">Joyent Manta Service Pricing</a></span>'
        };
    });
}(window.JP.getModule('docker')));
