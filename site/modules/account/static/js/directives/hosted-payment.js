'use strict';

(function (app) {

    app.directive('hostedPayment',[function () {

        return {
            restrict: 'A',
            replace: true,
            scope: true,
            link: function (scope) {},
            template: '<iframe id="z_hppm_iframe" name="z_hppm_iframe" width="500" height="450" src="account/iframe"></iframe>'
        };
    }]);
}(window.JP.getModule('Machine')));