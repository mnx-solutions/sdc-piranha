'use strict';

(function (ng, app) {
    app.directive('autoFocus', [
        '$timeout',
        function ($timeout) {
            return {
                restrict: 'A',
                link: function(scope, element) {
                    $timeout(function () {
                        ng.element(element[0]).focus();
                    }, 0);
                }
            };
        }]);
}(window.angular, window.JP.getModule('Account')));